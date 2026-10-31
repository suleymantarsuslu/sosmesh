import { Injectable } from '@nestjs/common';
import {
  DeliveryState,
  IncidentState,
  LocationStatus,
  Prisma,
  SosMessage,
} from '@prisma/client';
import { createHash } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { RELAY_ANOMALY_THRESHOLD, RELAY_ANOMALY_WINDOW_MS } from './ingest.constants';
import type { IngestRequestDto, IngestResponseDto } from './dto/ingest-request.dto';
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
    private readonly receiptSigner: ReceiptSignerService
  ) {}

  async processIngest(
    dto: IngestRequestDto,
    clientKey: string,
    rawBodyBytes: number
  ): Promise<IngestResponseDto> {
    this.rateLimit.assertAllowed(clientKey);
    this.packetService.assertWithinSizeLimit(rawBodyBytes);
    const { messageId, sosMessage } = this.packetService.validateRequest(dto);

    const existing = await this.prisma.sosMessage.findUnique({
      where: { messageId },
    });
    if (existing) {
      await this.recordRelayReceipt(existing.id, dto);
      return this.buildReceipt(existing);
    }

    try {
      const created = await this.createFirstAccept(messageId, sosMessage, dto, clientKey);
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
        await this.recordRelayReceipt(raced.id, dto);
        return this.buildReceipt(raced);
      }
      throw error;
    }
  }

  private buildReceipt(message: SosMessage): IngestResponseDto {
    const timestamp = message.serverReceiptAt ?? message.receivedAt;
    return {
      receipt: {
        ackType: 'SERVER_ACCEPTED',
        messageId: message.messageId,
        timestamp: timestamp.toISOString(),
        signature: this.receiptSigner.signServerAccepted(
          message.messageId,
          timestamp
        ),
      },
    };
  }

  private async createFirstAccept(
    messageId: string,
    sosMessage: Record<string, unknown>,
    dto: IngestRequestDto,
    clientKey: string
  ): Promise<SosMessage> {
    const envelope = sosMessage.envelope as Record<string, unknown>;
    const location = envelope.location as Record<string, unknown>;
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
          locationStatus: LocationStatus.GPS,
          latitude: new Prisma.Decimal(String(location.latitude)),
          longitude: new Prisma.Decimal(String(location.longitude)),
          accuracyMeters:
            typeof location.accuracy === 'number' ? location.accuracy : undefined,
          priority,
          encryptedPayloadRef: payloadRef,
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
          receiptHash: dto.transport.packetHash,
        },
      });

      return message;
    });
  }

  private async recordRelayReceipt(
    sosMessageId: string,
    dto: IngestRequestDto
  ): Promise<void> {
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
        receiptHash: dto.transport.packetHash,
      },
      update: {
        hopCount: dto.relayInfo.hopCount,
        receiptHash: dto.transport.packetHash,
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
