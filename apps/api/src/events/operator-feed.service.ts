import { Injectable } from '@nestjs/common';
import { LocationStatus, SosMessage } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type OperatorFeedEventDto = {
  id: string;
  messageId: string;
  incidentId: string;
  priority: number;
  locationStatus: LocationStatus;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
};

@Injectable()
export class OperatorFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async publishNewIncidentMessage(message: SosMessage): Promise<OperatorFeedEventDto> {
    const occurredAt = message.serverReceiptAt ?? message.receivedAt;
    const row = await this.prisma.operatorFeedEvent.create({
      data: {
        messageId: message.messageId,
        incidentId: message.incidentId,
        priority: message.priority,
        locationStatus: message.locationStatus,
        latitude: message.latitude,
        longitude: message.longitude,
        occurredAt,
      },
    });
    return this.toDto(row);
  }

  async listAfter(afterSeq: bigint, limit: number): Promise<OperatorFeedEventDto[]> {
    const rows = await this.prisma.operatorFeedEvent.findMany({
      where: { seq: { gt: afterSeq } },
      orderBy: { seq: 'asc' },
      take: limit,
    });
    return rows.map((row) => this.toDto(row));
  }

  private toDto(row: {
    seq: bigint;
    messageId: string;
    incidentId: string;
    priority: number;
    locationStatus: LocationStatus;
    latitude: { toNumber(): number } | null;
    longitude: { toNumber(): number } | null;
    occurredAt: Date;
  }): OperatorFeedEventDto {
    return {
      id: row.seq.toString(),
      messageId: row.messageId,
      incidentId: row.incidentId,
      priority: row.priority,
      locationStatus: row.locationStatus,
      latitude: row.latitude ? row.latitude.toNumber() : null,
      longitude: row.longitude ? row.longitude.toNumber() : null,
      occurredAt: row.occurredAt.toISOString(),
    };
  }
}
