import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { auditDetailsForWrite } from './audit-redaction.util';
import { readRetentionMaxAgeMs, retentionJobEnabled } from './retention.config';

export type RetentionRunResult = {
  ran: boolean;
  reason: string;
  deletedIncidents: number;
  deletedFeedEvents: number;
};

@Injectable()
export class PrivacyRetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async purgeExpiredRecords(actorId: string | null): Promise<RetentionRunResult> {
    if (!retentionJobEnabled()) {
      return { ran: false, reason: 'RETENTION_JOB_DISABLED', deletedIncidents: 0, deletedFeedEvents: 0 };
    }

    const maxAgeMs = readRetentionMaxAgeMs();
    if (maxAgeMs === null) {
      return {
        ran: false,
        reason: 'RETENTION_MAX_AGE_NOT_CONFIGURED',
        deletedIncidents: 0,
        deletedFeedEvents: 0,
      };
    }

    const cutoff = new Date(Date.now() - maxAgeMs);

    const staleMessages = await this.prisma.sosMessage.findMany({
      where: { receivedAt: { lt: cutoff } },
      select: { id: true, incidentId: true, messageId: true, receivedAt: true },
    });

    if (staleMessages.length === 0) {
      return {
        ran: true,
        reason: 'NO_EXPIRED_RECORDS',
        deletedIncidents: 0,
        deletedFeedEvents: 0,
      };
    }

    const incidentIds = [...new Set(staleMessages.map((row) => row.incidentId))];
    const messageIds = staleMessages.map((row) => row.messageId);

    const feedDelete = await this.prisma.operatorFeedEvent.deleteMany({
      where: { messageId: { in: messageIds } },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const incidentId of incidentIds) {
        await tx.auditLog.create({
          data: {
            actorId,
            incidentId: null,
            action: 'RETENTION_PURGE',
            detailsJson: auditDetailsForWrite({
              purgedIncidentId: incidentId,
              cutoff: cutoff.toISOString(),
              messageCount: staleMessages.filter((m) => m.incidentId === incidentId).length,
            }),
          },
        });
        await tx.auditLog.deleteMany({ where: { incidentId } });
        await tx.incident.delete({ where: { id: incidentId } });
      }
    });

    return {
      ran: true,
      reason: 'PURGED',
      deletedIncidents: incidentIds.length,
      deletedFeedEvents: feedDelete.count,
    };
  }
}
