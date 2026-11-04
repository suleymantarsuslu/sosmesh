import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ResourceKind, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

export type TeamSummary = {
  id: string;
  name: string;
  type: string | null;
  capacity: number | null;
  contactInfo: string | null;
  status: string | null;
  zoneCode: string | null;
  organizationId: string;
  resourceCount: number;
  openTaskCount: number;
  createdAt: string;
  updatedAt: string;
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

  private async defaultOrganizationId(): Promise<string> {
    const org = await this.prisma.organization.upsert({
      where: { slug: 'default' },
      update: {},
      create: { name: 'SOSMesh', slug: 'default' },
      select: { id: true },
    });
    return org.id;
  }

  private assertCanModifyTeams(user: OperatorRequestUser): void {
    if (user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only coordinators and admins can modify teams',
      });
    }
  }

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
        type: team.type,
        capacity: team.capacity,
        contactInfo: team.contactInfo,
        status: team.status,
        zoneCode: team.zoneCode,
        organizationId: team.organizationId,
        resourceCount: team._count.resources,
        openTaskCount: openByTeam.get(team.id) ?? 0,
        createdAt: team.createdAt.toISOString(),
        updatedAt: team.updatedAt.toISOString(),
      })),
    };
  }

  async createTeam(
    user: OperatorRequestUser,
    input: CreateTeamDto
  ): Promise<TeamSummary> {
    this.assertCanModifyTeams(user);

    const orgId = user.organizationId;
    if (!orgId && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No organization context',
      });
    }

    // Admins without an organization create teams in the default organization.
    const organizationId = orgId ?? (await this.defaultOrganizationId());

    const team = await this.prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          organizationId,
          name: input.name,
          type: input.type,
          capacity: input.capacity,
          contactInfo: input.contactInfo,
          status: input.status,
          zoneCode: input.zoneCode,
        },
        include: {
          _count: { select: { resources: true, workTasks: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          action: 'team.create',
          detailsJson: {
            teamId: created.id,
            before: null,
            after: {
              name: created.name,
              type: created.type,
              status: created.status,
              zoneCode: created.zoneCode,
            },
          },
        },
      });

      return created;
    });

    return {
      id: team.id,
      name: team.name,
      type: team.type,
      capacity: team.capacity,
      contactInfo: team.contactInfo,
      status: team.status,
      zoneCode: team.zoneCode,
      organizationId: team.organizationId,
      resourceCount: team._count.resources,
      openTaskCount: 0,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    };
  }

  async updateTeam(
    user: OperatorRequestUser,
    teamId: string,
    input: UpdateTeamDto
  ): Promise<TeamSummary> {
    this.assertCanModifyTeams(user);

    const scopeWhere = this.scope.teamWhere(user);
    const existing = await this.prisma.team.findFirst({
      where: { id: teamId, ...scopeWhere },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Team not found' });
    }

    const team = await this.prisma.$transaction(async (tx) => {
      const before = {
        name: existing.name,
        type: existing.type,
        capacity: existing.capacity,
        contactInfo: existing.contactInfo,
        status: existing.status,
        zoneCode: existing.zoneCode,
      };

      const updated = await tx.team.update({
        where: { id: teamId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.contactInfo !== undefined ? { contactInfo: input.contactInfo } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.zoneCode !== undefined ? { zoneCode: input.zoneCode } : {}),
        },
        include: {
          _count: { select: { resources: true, workTasks: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          action: 'team.update',
          detailsJson: {
            teamId,
            before,
            after: {
              name: updated.name,
              type: updated.type,
              capacity: updated.capacity,
              contactInfo: updated.contactInfo,
              status: updated.status,
              zoneCode: updated.zoneCode,
            },
          },
        },
      });

      return updated;
    });

    const openCounts = await this.prisma.workTask.groupBy({
      by: ['teamId'],
      where: {
        teamId,
        status: { in: ['PROPOSED', 'ASSIGNED', 'ACCEPTED'] },
      },
      _count: { _all: true },
    });

    return {
      id: team.id,
      name: team.name,
      type: team.type,
      capacity: team.capacity,
      contactInfo: team.contactInfo,
      status: team.status,
      zoneCode: team.zoneCode,
      organizationId: team.organizationId,
      resourceCount: team._count.resources,
      openTaskCount: openCounts[0]?._count._all ?? 0,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
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

    let row;
    if (input.id) {
      const scopeWhere = this.scope.resourceWhere(user);
      const existing = await this.prisma.resource.findFirst({
        where: { id: input.id, ...scopeWhere },
      });
      if (!existing) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
      row = await this.prisma.resource.update({
        where: { id: input.id },
        data: {
          kind: input.kind,
          name: input.name,
          capacity: input.capacity,
          zoneCode: input.zoneCode,
          availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
          availableUntil: input.availableUntil ? new Date(input.availableUntil) : null,
        },
      });
    } else {
      row = await this.prisma.resource.create({ data });
    }

    const list = await this.listResources(user, {});
    const found = list.items.find((item) => item.id === row.id);
    if (!found) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
    }
    return found;
  }

  async updateResource(
    user: OperatorRequestUser,
    resourceId: string,
    input: UpdateResourceDto
  ): Promise<ResourceDto> {
    if (user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only coordinators and admins can modify resources',
      });
    }

    const scopeWhere = this.scope.resourceWhere(user);
    const existing = await this.prisma.resource.findFirst({
      where: { id: resourceId, ...scopeWhere },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
    }

    if (input.teamId !== undefined) {
      if (input.teamId) {
        const teamOk = await this.scope.canAccessTeam(user, input.teamId, this.prisma);
        if (!teamOk) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Team not found' });
        }
      }
    }

    const resource = await this.prisma.$transaction(async (tx) => {
      const before = {
        kind: existing.kind,
        name: existing.name,
        capacity: existing.capacity,
        zoneCode: existing.zoneCode,
        teamId: existing.teamId,
        isActive: existing.isActive,
        availableFrom: existing.availableFrom?.toISOString() ?? null,
        availableUntil: existing.availableUntil?.toISOString() ?? null,
      };

      const updated = await tx.resource.update({
        where: { id: resourceId },
        data: {
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          ...(input.zoneCode !== undefined ? { zoneCode: input.zoneCode } : {}),
          ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.availableFrom !== undefined
            ? { availableFrom: input.availableFrom ? new Date(input.availableFrom) : null }
            : {}),
          ...(input.availableUntil !== undefined
            ? { availableUntil: input.availableUntil ? new Date(input.availableUntil) : null }
            : {}),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          action: 'resource.update',
          detailsJson: {
            resourceId,
            before,
            after: {
              kind: updated.kind,
              name: updated.name,
              capacity: updated.capacity,
              zoneCode: updated.zoneCode,
              teamId: updated.teamId,
              isActive: updated.isActive,
              availableFrom: updated.availableFrom?.toISOString() ?? null,
              availableUntil: updated.availableUntil?.toISOString() ?? null,
            },
          },
        },
      });

      return updated;
    });

    const list = await this.listResources(user, {});
    const found = list.items.find((item) => item.id === resource.id);
    if (!found) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
    }
    return found;
  }
}
