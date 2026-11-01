import { Injectable } from '@nestjs/common';
import { LocationStatus, Prisma, SosMessage } from '@prisma/client';

import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';
import { IncidentScopeService } from '../operator/incident-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { OPERATOR_FEED_ADVISORY_LOCK_KEY } from './operator-feed.constants';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService
  ) {}

  /**
   * Must run inside the same DB transaction as first SOS accept so feed failure rolls back
   * the SOS row (client retry can safely re-attempt first accept).
   */
  async insertFirstAcceptInTransaction(
    tx: Prisma.TransactionClient,
    message: SosMessage
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${OPERATOR_FEED_ADVISORY_LOCK_KEY}::bigint)`;
    const occurredAt = message.serverReceiptAt ?? message.receivedAt;
    await tx.operatorFeedEvent.create({
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
  }

  async listAfter(
    user: OperatorRequestUser,
    afterSeq: bigint,
    limit: number
  ): Promise<OperatorFeedEventDto[]> {
    const incidentScope = this.scope.incidentWhere(user);
    let incidentIdFilter: { incidentId: { in: string[] } } | undefined;
    if (incidentScope) {
      const allowed = await this.prisma.incident.findMany({
        where: incidentScope,
        select: { id: true },
        take: 500,
      });
      incidentIdFilter = { incidentId: { in: allowed.map((row) => row.id) } };
      if (allowed.length === 0) {
        return [];
      }
    }
    const rows = await this.prisma.operatorFeedEvent.findMany({
      where: {
        seq: { gt: afterSeq },
        ...incidentIdFilter,
      },
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
