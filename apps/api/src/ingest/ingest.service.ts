import { ConflictException, Injectable } from '@nestjs/common';
import {
  DeliveryState,
  IncidentState,
  Prisma,
  SosMessage,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '@sosmesh/contracts';

import { AiJobQueueService } from '../ai/ai-job-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { OperatorFeedService } from '../events/operator-feed.service';
import { DeviceUploadTokenService } from '../media/device-upload-token.service';
import { RELAY_ANOMALY_THRESHOLD, RELAY_ANOMALY_WINDOW_MS } from './ingest.constants';
import type { IngestRequestDto, IngestResponseDto } from './dto/ingest-request.dto';
import { parseEnvelopeGeo } from './envelope-location';
import { IngestPacketService } from './ingest-packet.service';
import { IngestRateLimitService } from './ingest-rate-limit.service';
import { ReceiptSignerService } from './receipt-signer.service';
import { SosMeshMetricsService } from '../observability/sosmesh-metrics.service';
import { StructuredEventLogger } from '../observability/structured-event-logger.service';
import { extractClientAad } from './envelope-aad-builder';
import { MeshV2IngestService, type MeshV2Context } from '../mesh-v2/mesh-v2-ingest.service';

type RelayWindow = { count: number; windowStartMs: number };

@Injectable()
export class IngestService {
  private readonly relayWindows = new Map<string, RelayWindow>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly packetService: IngestPacketService,
    private readonly rateLimit: IngestRateLimitService,
    private readonly receiptSigner: ReceiptSignerService,
    private readonly operatorFeed: OperatorFeedService,
    private readonly aiJobQueue: AiJobQueueService,
    private readonly metrics: SosMeshMetricsService,
    private readonly events: StructuredEventLogger,
    private readonly uploadToken: DeviceUploadTokenService,
    private readonly meshV2: MeshV2IngestService
  ) {}

  async processIngest(
    dto: IngestRequestDto,
    clientKey: string,
    rawBodyBytes: number
  ): Promise<IngestResponseDto> {
    this.rateLimit.assertAllowed(clientKey);
    this.packetService.assertWithinSizeLimit(rawBodyBytes);
    const { messageId, sosMessage } = this.packetService.validateRequest(dto);
    this.metrics.recordIngestValid();
    const packetHash = dto.transport.packetHash;

    const existing = await this.prisma.sosMessage.findUnique({
      where: { messageId },
    });
    if (existing) {
      this.metrics.recordIngestDedup();
      await this.ensureSamePacketHash(existing, packetHash, dto);
      await this.recordRelayReceipt(existing.id, dto);
      this.metrics.recordRadioAck();
      this.recordPeerLagFromRelay(dto);
      this.events.emit('ingest_dedup_server_receipt', { messageId, relayHopCount: dto.relayInfo.hopCount });
      return this.buildReceipt(existing);
    }

    try {
      const { message: created, merged } = await this.createFirstAccept(
        messageId,
        sosMessage,
        dto,
        clientKey,
        packetHash
      );
      const response = this.buildReceipt(created);
      return merged === null ? response : { ...response, merged };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.sosMessage.findUnique({
          where: { messageId },
        });
        if (!raced) {
          throw error;
        }
        await this.ensureSamePacketHash(raced, packetHash, dto);
        await this.recordRelayReceipt(raced.id, dto);
        this.metrics.recordIngestDedup();
        this.metrics.recordRadioAck();
        this.recordPeerLagFromRelay(dto);
        return this.buildReceipt(raced);
      }
      throw error;
    }
  }

  private async ensureSamePacketHash(
    existing: SosMessage,
    packetHash: string,
    dto: IngestRequestDto
  ): Promise<void> {
    if (existing.packetHash === packetHash) {
      return;
    }
    await this.recordMessageIdConflict(existing, dto);
    throw new ConflictException({
      code: 'MESSAGE_ID_CONFLICT',
      message: 'message_id is already bound to a different packet hash',
    });
  }

  private buildReceipt(message: SosMessage): IngestResponseDto {
    const timestamp = message.serverReceiptAt ?? message.receivedAt;
    const packetHash = message.packetHash;
    if (!packetHash) {
      throw new Error('Stored SOS message is missing packet_hash for receipt signing');
    }
    const uploadToken = this.uploadToken.generateToken(message.messageId, packetHash);
    return {
      receipt: {
        ackType: 'SERVER_ACCEPTED',
        messageId: message.messageId,
        packetHash,
        timestamp: timestamp.toISOString(),
        signature: this.receiptSigner.signServerAccepted(
          message.messageId,
          packetHash,
          timestamp
        ),
        uploadToken,
      },
    };
  }

  private async createFirstAccept(
    messageId: string,
    sosMessage: Record<string, unknown>,
    dto: IngestRequestDto,
    clientKey: string,
    packetHash: string
  ): Promise<{ message: SosMessage; merged: boolean | null }> {
    const envelope = sosMessage.envelope as Record<string, unknown>;
    const geo = parseEnvelopeGeo(envelope);
    const priority = typeof envelope.priority === 'number' ? envelope.priority : 3;
    const encryptedPayload = String(sosMessage.encryptedPayload ?? '');
    const payloadRef = createHash('sha256').update(encryptedPayload, 'utf8').digest('hex');
    const needsHumanReview = this.markRelayAnomaly(dto.relayInfo.relayId, clientKey);
    if (needsHumanReview) {
      this.metrics.recordGpsAnomaly();
    }
    const receiptAt = new Date();
    const clientAad = extractClientAad(envelope);
    const originalEnvelopeAad = canonicalJSON(clientAad);

    // Mesh v2 (§8.2): decrypt L3 in memory; v1 / undecryptable payloads skip all of this.
    const inner = await this.meshV2.decryptInner(encryptedPayload, clientAad);
    const v2: MeshV2Context | null = inner ? await this.meshV2.prepare(inner, receiptAt, priority) : null;

    return this.prisma.$transaction(async (tx) => {
      const mergeTarget = v2 ? await this.meshV2.findMergeTarget(tx, v2.senderId, receiptAt) : null;
      const locationUpdate = v2 ? this.meshV2.latestLocationUpdate(v2.inner, mergeTarget?.latestLocationAt ?? null) : null;
      const incident = mergeTarget
        ? await tx.incident.update({
            where: { id: mergeTarget.id },
            data: {
              mergedMessageCount: { increment: 1 },
              lastMessageAt: receiptAt,
              ...(locationUpdate ?? {}),
            },
          })
        : await tx.incident.create({
            data: {
              state: IncidentState.PENDING,
              ...(v2 ? { senderId: v2.senderId, lastMessageAt: receiptAt, ...(locationUpdate ?? {}) } : {}),
            },
          });
      if (v2) {
        await this.meshV2.storeLatestProfile(tx, v2);
      }
      const innerLoc = v2?.inner.location;

      const message = await tx.sosMessage.create({
        data: {
          messageId,
          incidentId: incident.id,
          deliveryState: DeliveryState.SERVER_ACCEPTED,
          locationStatus: geo.locationStatus,
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracyMeters: geo.accuracyMeters,
          priority,
          encryptedNoteBlob: encryptedPayload || null,
          encryptedPayloadRef: payloadRef,
          originalEnvelopeAad,
          packetHash,
          serverReceiptAt: receiptAt,
          needsHumanReview,
          ...(v2
            ? {
                senderId: v2.senderId,
                innerVersion: 2,
                senderSeq: BigInt(v2.inner.seq),
                ...(v2.inner.sosType ? { sosType: v2.inner.sosType } : {}),
                ...(v2.inner.personCount ? { personCount: v2.inner.personCount } : {}),
                ...(innerLoc
                  ? {
                      preciseLatitude: innerLoc.latitude,
                      preciseLongitude: innerLoc.longitude,
                      preciseAccuracyMeters: innerLoc.accuracyMeters ?? null,
                      preciseCapturedAt: new Date(innerLoc.timestamp),
                    }
                  : {}),
              }
            : {}),
        },
      });

      await tx.messageEvent.create({
        data: {
          sosMessageId: message.id,
          deliveryState: DeliveryState.SERVER_ACCEPTED,
          source: 'ingest',
          metadataJson: {
            relayId: dto.relayInfo.relayId,
            hopCount: dto.relayInfo.hopCount,
            needsHumanReview,
            ...(mergeTarget ? { event: 'SOS_MERGED' } : {}),
          },
        },
      });

      await tx.relayReceipt.create({
        data: {
          sosMessageId: message.id,
          relayId: dto.relayInfo.relayId,
          hopCount: dto.relayInfo.hopCount,
          receiptHash: packetHash,
        },
      });

      await this.operatorFeed.insertFirstAcceptInTransaction(tx, message);

      return { message, incidentId: incident.id, merged: mergeTarget !== null };
    }).then(({ message, incidentId, merged }) => {
      this.metrics.recordIngestAccepted();
      this.metrics.recordServerAck();
      this.metrics.recordRadioAck();
      this.recordServerLagFromRelay(dto, receiptAt);
      this.events.emit('ingest_first_accept', {
        messageId,
        incidentId,
        needsHumanReview,
      });
      if (v2 && merged) {
        this.events.emit('sos_merged', { messageId, incidentId, senderTag: v2.senderTag });
      }

      // Enqueue AI job AFTER transaction commits (never delay receipt).
      // Mesh v2: above 30/h per sender messages are still accepted and merged, but not re-triaged.
      if (process.env.AI_ENABLED === 'true' && (v2?.fullProcessing ?? true)) {
        void this.aiJobQueue.enqueue({
          kind: 'triage',
          incidentId,
          sosMessageId: message.id,
        }).catch((error) => {
          this.events.emit('ai_enqueue_failed', {
            incidentId,
            messageId,
            error: error instanceof Error ? error.message : 'unknown',
          });
        });
      }
      
      return { message, merged: v2 ? merged : null };
    });
  }

  private async recordMessageIdConflict(
    existing: SosMessage,
    dto: IngestRequestDto
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.sosMessage.update({
        where: { id: existing.id },
        data: { needsHumanReview: true },
      }),
      this.prisma.messageEvent.create({
        data: {
          sosMessageId: existing.id,
          deliveryState: existing.deliveryState,
          source: 'ingest',
          metadataJson: {
            anomaly: 'MESSAGE_ID_CONFLICT',
            relayId: dto.relayInfo.relayId,
            hopCount: dto.relayInfo.hopCount,
          },
        },
      }),
    ]);
  }

  private async recordRelayReceipt(
    sosMessageId: string,
    dto: IngestRequestDto
  ): Promise<void> {
    const packetHash = dto.transport.packetHash;
    await this.prisma.relayReceipt.upsert({
      where: {
        sosMessageId_relayId: {
          sosMessageId,
          relayId: dto.relayInfo.relayId,
        },
      },
      create: {
        sosMessageId,
        relayId: dto.relayInfo.relayId,
        hopCount: dto.relayInfo.hopCount,
        receiptHash: packetHash,
      },
      update: {
        hopCount: dto.relayInfo.hopCount,
        receiptHash: packetHash,
      },
    });
  }

  private markRelayAnomaly(relayId: string, clientKey: string): boolean {
    const key = `${clientKey}:${relayId}`;
    const now = Date.now();
    const existing = this.relayWindows.get(key);
    if (!existing || now - existing.windowStartMs >= RELAY_ANOMALY_WINDOW_MS) {
      this.relayWindows.set(key, { count: 1, windowStartMs: now });
      return false;
    }
    existing.count += 1;
    return existing.count > RELAY_ANOMALY_THRESHOLD;
  }

  private recordServerLagFromRelay(dto: IngestRequestDto, receiptAt: Date): void {
    const relayMs = Date.parse(dto.relayInfo.relayTimestamp);
    if (Number.isNaN(relayMs)) {
      return;
    }
    const seconds = Math.max(0, (receiptAt.getTime() - relayMs) / 1000);
    this.metrics.observeUserLagServer(seconds);
  }

  private recordPeerLagFromRelay(dto: IngestRequestDto): void {
    const relayMs = Date.parse(dto.relayInfo.relayTimestamp);
    if (Number.isNaN(relayMs)) {
      return;
    }
    const seconds = Math.max(0, (Date.now() - relayMs) / 1000);
    this.metrics.observeUserLagPeer(seconds);
  }
}
