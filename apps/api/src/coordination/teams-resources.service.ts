import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResourceKind } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';

export type TeamSummary = {
  id: string;
  name: string;
  zoneCode: string | null;
  organizationId: string;
  resourceCount: number;
  openTaskCount: number;
};

export type ResourceDto = {
  id: string;
  kind: ResourceKind;
  name: string;
  capacity: number;
  zoneCode: string | null;
  teamId: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  isActive: boolean;
  isAvailableNow: boolean;
};

@Injectable()
export class TeamsResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService
  ) {}

  async listTeams(user: OperatorRequestUser): Promise<{ items: TeamSummary[] }> {
    const where = this.scope.teamWhere(user);
    const teams = await this.prisma.team.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { resources: true, workTasks: true } },
      },
    });
    const openCounts = await this.prisma.workTask.groupBy({
      by: ['teamId'],
      where: {
        status: { in: ['PROPOSED', 'ASSIGNED', 'ACCEPTED'] },
        ...(where ? { team: where } : {}),
      },
      _count: { _all: true },
    });
    const openByTeam = new Map(openCounts.map((row) => [row.teamId, row._count._all]));

    return {
      items: teams.map((team) => ({
        id: team.id,
        name: team.name,
        zoneCode: team.zoneCode,
        organizationId: team.organizationId,
        resourceCount: team._count.resources,
        openTaskCount: openByTeam.get(team.id) ?? 0,
      })),
    };
  }

  async listResources(
    user: OperatorRequestUser,
    query: { teamId?: string; kind?: ResourceKind }
  ): Promise<{ items: ResourceDto[] }> {
    const scopeWhere = this.scope.resourceWhere(user);
    const rows = await this.prisma.resource.findMany({
      where: {
        ...scopeWhere,
        ...(query.teamId ? { teamId: query.teamId } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
    const now = new Date();
    return {
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: row.name,
        capacity: row.capacity,
        zoneCode: row.zoneCode,
        teamId: row.teamId,
        availableFrom: row.availableFrom?.toISOString() ?? null,
        availableUntil: row.availableUntil?.toISOString() ?? null,
        isActive: row.isActive,
        isAvailableNow:
          row.isActive &&
          (!row.availableFrom || row.availableFrom <= now) &&
          (!row.availableUntil || row.availableUntil >= now),
      })),
    };
  }

  async upsertResource(
    user: OperatorRequestUser,
    input: {
      id?: string;
      teamId?: string;
      kind: ResourceKind;
      name: string;
      capacity: number;
      zoneCode?: string;
      availableFrom?: string;
      availableUntil?: string;
    }
  ): Promise<ResourceDto> {
    if (user.role !== 'COORDINATOR' && user.role !== 'ADMIN') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
    }
    const orgId = user.organizationId;
    if (!orgId && user.role !== 'ADMIN') {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
    }

    if (input.teamId) {
      const teamOk = await this.scope.canAccessTeam(user, input.teamId, this.prisma);
      if (!teamOk) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Team not found' });
      }
    }

    const organizationId =
      orgId ??
      (
        await this.prisma.team.findUnique({
          where: { id: input.teamId! },
          select: { organizationId: true },
        })
      )?.organizationId;

    if (!organizationId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
    }

    const data: Prisma.ResourceCreateInput = {
      organization: { connect: { id: organizationId } },
      ...(input.teamId ? { team: { connect: { id: input.teamId } } } : {}),
      kind: input.kind,
      name: input.name,
      capacity: input.capacity,
      zoneCode: input.zoneCode,
      availableFrom: input.availableFrom ? new Date(input.availableFrom) : undefined,
      availableUntil: input.availableUntil ? new Date(input.availableUntil) : undefined,
    };

    const row = input.id
      ? await this.prisma.resource.update({
          where: { id: input.id },
          data: {
            kind: input.kind,
            name: input.name,
            capacity: input.capacity,
            zoneCode: input.zoneCode,
            availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
            availableUntil: input.availableUntil ? new Date(input.availableUntil) : null,
          },
        })
      : await this.prisma.resource.create({ data });

    const list = await this.listResources(user, {});
    const found = list.items.find((item) => item.id === row.id);
    if (!found) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
    }
    return found;
  }
}
