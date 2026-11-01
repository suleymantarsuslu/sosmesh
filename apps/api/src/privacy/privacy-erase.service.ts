import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';
import { auditDetailsForWrite } from './audit-redaction.util';

export type EraseIncidentResult = {
  incidentId: string;
  erased: boolean;
  deletedMessageIds: string[];
};

@Injectable()
export class PrivacyEraseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService
  ) {}

  async eraseIncident(user: OperatorRequestUser, incidentId: string): Promise<EraseIncidentResult> {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const messages = await this.prisma.sosMessage.findMany({
      where: { incidentId },
      select: { id: true, messageId: true },
    });
    if (messages.length === 0) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const messageIds = messages.map((row) => row.messageId);

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          incidentId: null,
          action: 'PRIVACY_ERASE_REQUEST',
          detailsJson: auditDetailsForWrite({
            requestKind: 'operator_erase',
            erasedIncidentId: incidentId,
            messageCount: messages.length,
          }),
        },
      });

      await tx.auditLog.deleteMany({ where: { incidentId } });

      await tx.operatorFeedEvent.deleteMany({
        where: { messageId: { in: messageIds } },
      });

      await tx.incident.delete({ where: { id: incidentId } });
    });

    return {
      incidentId,
      erased: true,
      deletedMessageIds: messageIds,
    };
  }
}
