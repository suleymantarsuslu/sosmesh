import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';
import { TenantScopeService } from './tenant-scope.service';

export type OrganizationContext = {
  organization: { id: string; name: string; slug: string } | null;
  team: { id: string; name: string; zoneCode: string | null } | null;
  role: string;
  incidents: { id: string; state: string; createdAt: string }[];
};

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: TenantScopeService
  ) {}

  async getOperatorContext(user: OperatorRequestUser): Promise<OrganizationContext> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        role: true,
        team: {
          select: {
            id: true,
            name: true,
            zoneCode: true,
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
      },
    });

    const scopeWhere = this.scope.incidentWhere(user);
    const incidents = await this.prisma.incident.findMany({
      where: scopeWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        state: true,
        createdAt: true,
      },
    });

    return {
      organization: dbUser?.team?.organization ?? null,
      team: dbUser?.team
        ? {
            id: dbUser.team.id,
            name: dbUser.team.name,
            zoneCode: dbUser.team.zoneCode,
          }
        : null,
      role: dbUser?.role ?? user.role,
      incidents: incidents.map((row) => ({
        id: row.id,
        state: row.state,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }
}
