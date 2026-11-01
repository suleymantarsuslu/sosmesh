import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';

export type ActivityEntry = {
  id: string;
  kind: 'audit' | 'message_event' | 'notification';
  action: string;
  actorId: string | null;
  actorDisplayName: string | null;
  incidentId: string | null;
  createdAt: string;
  summary: string;
};

@Injectable()
export class ActivityTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService
  ) {}

  async listActivity(
    user: OperatorRequestUser,
    query: { incidentId?: string; limit?: number }
  ): Promise<{ items: ActivityEntry[] }> {
    const limit = Math.min(query.limit ?? 50, 100);
    const incidentWhere = this.scope.incidentWhere(user);

    const audits = await this.prisma.auditLog.findMany({
      where: {
        ...(query.incidentId
          ? { incidentId: query.incidentId }
          : incidentWhere
            ? { incident: incidentWhere }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { displayName: true } },
      },
    });

    const items: ActivityEntry[] = audits.map((row) => ({
      id: row.id,
      kind: 'audit',
      action: row.action,
      actorId: row.actorId,
      actorDisplayName: row.actor?.displayName ?? null,
      incidentId: row.incidentId,
      createdAt: row.createdAt.toISOString(),
      summary: row.action,
    }));

    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { items: items.slice(0, limit) };
  }

  async exportAudit(
    user: OperatorRequestUser,
    query: { incidentId?: string }
  ): Promise<{ items: ActivityEntry[] }> {
    if (user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Export requires coordinator or admin role',
      });
    }
    return this.listActivity(user, { ...query, limit: 100 });
  }
}
