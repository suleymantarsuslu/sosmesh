import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';

export type LocationShareDto = {
  userId: string;
  displayName: string;
  zoneCode: string | null;
  expiresAt: string;
  location: { latitude: number; longitude: number } | null;
};

@Injectable()
export class LocationShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService
  ) {}

  async grantShare(
    user: OperatorRequestUser,
    input: {
      expiresAt: string;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<{ id: string; expiresAt: string }> {
    if (!user.teamId) {
      throw new BadRequestException({ code: 'NO_TEAM', message: 'User has no team' });
    }
    const expiresAt = new Date(input.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException({
        code: 'INVALID_EXPIRY',
        message: 'expiresAt must be in the future',
      });
    }

    const grant = await this.prisma.locationShareGrant.create({
      data: {
        userId: user.sub,
        teamId: user.teamId,
        expiresAt,
        latitude: input.latitude,
        longitude: input.longitude,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'location_share.grant',
        detailsJson: {
          grantId: grant.id,
          expiresAt: grant.expiresAt.toISOString(),
          hasCoordinates: input.latitude !== undefined && input.longitude !== undefined,
        },
      },
    });

    return { id: grant.id, expiresAt: grant.expiresAt.toISOString() };
  }

  async listTeamLocations(user: OperatorRequestUser): Promise<{ items: LocationShareDto[] }> {
    const teamWhere = this.scope.teamWhere(user);
    const teams = await this.prisma.team.findMany({
      where: teamWhere,
      select: { id: true },
    });
    const teamIds = teams.map((t) => t.id);
    if (!teamIds.length) {
      return { items: [] };
    }

    const now = new Date();
    const rows = await this.prisma.locationShareGrant.findMany({
      where: {
        teamId: { in: teamIds },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        user: { select: { id: true, displayName: true } },
        team: { select: { zoneCode: true } },
      },
      orderBy: { expiresAt: 'asc' },
    });

    return {
      items: rows.map((row) => ({
        userId: row.userId,
        displayName: row.user.displayName,
        zoneCode: row.team.zoneCode,
        expiresAt: row.expiresAt.toISOString(),
        location:
          row.latitude !== null && row.longitude !== null
            ? {
                latitude: Number(row.latitude),
                longitude: Number(row.longitude),
              }
            : null,
      })),
    };
  }

  async revokeShare(user: OperatorRequestUser, grantId: string): Promise<void> {
    const grant = await this.prisma.locationShareGrant.findFirst({
      where: { id: grantId, userId: user.sub, revokedAt: null },
    });
    if (!grant) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Grant not found' });
    }
    await this.prisma.locationShareGrant.update({
      where: { id: grantId },
      data: { revokedAt: new Date(), latitude: null, longitude: null },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        action: 'location_share.revoke',
        detailsJson: { grantId },
      },
    });
  }
}
