import { Injectable } from '@nestjs/common';
import { IncidentState } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { OperatorRequestUser } from './guards/operator-auth.guard';
import { IncidentScopeService } from './incident-scope.service';

export type DashboardStats = {
  newSos: number | null;
  openOnPanel: number | null;
  pending: number | null;
  avgReachSeconds: number | null;
  hasData: boolean;
};

@Injectable()
export class OperatorDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService
  ) {}

  async getStats(user: OperatorRequestUser): Promise<DashboardStats> {
    const scopeWhere = this.scope.incidentWhere(user);
    const incidentFilter = scopeWhere ? { incident: scopeWhere } : {};

    const [messageCount, openCount, pendingCount, reachSamples] = await Promise.all([
      this.prisma.sosMessage.count({ where: incidentFilter }),
      this.prisma.incident.count({
        where: {
          ...scopeWhere,
          state: { in: [IncidentState.PENDING, IncidentState.ASSIGNED, IncidentState.IN_PROGRESS] },
        },
      }),
      this.prisma.incident.count({
        where: {
          ...scopeWhere,
          state: IncidentState.PENDING,
        },
      }),
      this.prisma.sosMessage.findMany({
        where: {
          ...incidentFilter,
          serverReceiptAt: { not: null },
        },
        select: { receivedAt: true, serverReceiptAt: true },
        take: 500,
      }),
    ]);

    const hasData = messageCount > 0 || openCount > 0 || pendingCount > 0;
    if (!hasData) {
      return {
        newSos: null,
        openOnPanel: null,
        pending: null,
        avgReachSeconds: null,
        hasData: false,
      };
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newSos = await this.prisma.sosMessage.count({
      where: {
        ...incidentFilter,
        receivedAt: { gte: dayAgo },
      },
    });

    let avgReachSeconds: number | null = null;
    if (reachSamples.length > 0) {
      const totalSeconds = reachSamples.reduce((sum, row) => {
        const delta =
          (row.serverReceiptAt!.getTime() - row.receivedAt.getTime()) / 1000;
        return sum + Math.max(0, delta);
      }, 0);
      avgReachSeconds = Math.round(totalSeconds / reachSamples.length);
    }

    return {
      newSos,
      openOnPanel: openCount,
      pending: pendingCount,
      avgReachSeconds,
      hasData: true,
    };
  }
}
