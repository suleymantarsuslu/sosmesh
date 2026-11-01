import { ConflictException, Injectable } from '@nestjs/common';
import {
  DeliveryState,
  IncidentState,
  Prisma,
  SosMessage,
} from '@prisma/client';
import { createHash } from 'node:crypto';

import { AiJobService } from '../ai/ai-job.service';
import { PrismaService } from '../prisma/prisma.service';
import { RELAY_ANOMALY_THRESHOLD, RELAY_ANOMALY_WINDOW_MS } from './ingest.constants';
import type { IngestRequestDto, IngestResponseDto } from './dto/ingest-request.dto';
import { parseEnvelopeGeo } from './envelope-location';
import { IngestPacketService } from './ingest-packet.service';
import { IngestRateLimitService } from './ingest-rate-limit.service';
import { ReceiptSignerService } from './receipt-signer.service';

type RelayWindow = { count: number; windowStartMs: number };

@Injectable()
export class IngestService {
  private readonly relayWindows = new Map<string, RelayWindow>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly packetService: IngestPacketService,
    private readonly rateLimit: IngestRateLimitService,
    private readonly receiptSigner: ReceiptSignerService,
    private readonly aiJobs: AiJobService
  ) {}

  async processIngest(
    dto: IngestRequestDto,
    clientKey: string,
    rawBodyBytes: number
  ): Promise<IngestResponseDto> {
    this.rateLimit.assertAllowed(clientKey);
    this.packetService.assertWithinSizeLimit(rawBodyBytes);
    const { messageId, sosMessage } = this.packetService.validateRequest(dto);
    const packetHash = dto.transport.packetHash;

    const existing = await this.prisma.sosMessage.findUnique({
      where: { messageId },
    });
    if (existing) {
      await this.ensureSamePacketHash(existing, packetHash, dto);
      await this.recordRelayReceipt(existing.id, dto);
      return this.buildReceipt(existing);
    }

    try {
      const created = await this.createFirstAccept(
        messageId,
        sosMessage,
        dto,
        clientKey,
        packetHash
      );
      return this.buildReceipt(created);
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
      },
    };
  }

  private async createFirstAccept(
    messageId: string,
    sosMessage: Record<string, unknown>,
    dto: IngestRequestDto,
    clientKey: string,
    packetHash: string
  ): Promise<SosMessage> {
    const envelope = sosMessage.envelope as Record<string, unknown>;
    const geo = parseEnvelopeGeo(envelope);
    const priority = typeof envelope.priority === 'number' ? envelope.priority : 3;
    const encryptedPayload = String(sosMessage.encryptedPayload ?? '');
    const payloadRef = createHash('sha256').update(encryptedPayload, 'utf8').digest('hex');
    const needsHumanReview = this.markRelayAnomaly(dto.relayInfo.relayId, clientKey);
    const receiptAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: { state: IncidentState.PENDING },
      });

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
          encryptedPayloadRef: payloadRef,
          packetHash,
          serverReceiptAt: receiptAt,
          needsHumanReview,
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

      return { message, incidentId: incident.id };
    }).then(({ message, incidentId }) => {
      this.aiJobs.enqueueAfterIngest({
        incidentId,
        messageId,
        tenantKey: clientKey,
      });
      return message;
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
}
