import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';

@Injectable()
export class TenantScopeService {
  isAdmin(user: OperatorRequestUser): boolean {
    return user.role === UserRole.ADMIN;
  }

  isOrgCoordinator(user: OperatorRequestUser): boolean {
    return user.role === UserRole.COORDINATOR;
  }

  incidentWhere(user: OperatorRequestUser): Prisma.IncidentWhereInput | undefined {
    if (this.isAdmin(user)) {
      return undefined;
    }

    if (!user.teamId || !user.organizationId) {
      return { id: { in: [] } };
    }

    if (this.isOrgCoordinator(user)) {
      return {
        assignments: {
          some: {
            team: {
              organizationId: user.organizationId,
            },
          },
        },
      };
    }

    return {
      assignments: {
        some: {
          teamId: user.teamId,
          team: {
            organizationId: user.organizationId,
          },
        },
      },
    };
  }

  teamWhere(user: OperatorRequestUser): Prisma.TeamWhereInput | undefined {
    if (this.isAdmin(user)) {
      return undefined;
    }
    if (!user.organizationId) {
      return { id: { in: [] } };
    }
    if (this.isOrgCoordinator(user)) {
      return { organizationId: user.organizationId };
    }
    if (!user.teamId) {
      return { id: { in: [] } };
    }
    return { id: user.teamId, organizationId: user.organizationId };
  }

  resourceWhere(user: OperatorRequestUser): Prisma.ResourceWhereInput | undefined {
    if (this.isAdmin(user)) {
      return undefined;
    }
    if (!user.organizationId) {
      return { id: { in: [] } };
    }
    if (this.isOrgCoordinator(user)) {
      return { organizationId: user.organizationId };
    }
    if (!user.teamId) {
      return { id: { in: [] } };
    }
    return {
      organizationId: user.organizationId,
      OR: [{ teamId: user.teamId }, { teamId: null }],
    };
  }

  workTaskWhere(user: OperatorRequestUser): Prisma.WorkTaskWhereInput | undefined {
    if (this.isAdmin(user)) {
      return undefined;
    }
    if (!user.organizationId) {
      return { id: { in: [] } };
    }
    if (this.isOrgCoordinator(user)) {
      return {
        team: { organizationId: user.organizationId },
      };
    }
    if (!user.teamId) {
      return { id: { in: [] } };
    }
    return {
      teamId: user.teamId,
      team: { organizationId: user.organizationId },
    };
  }

  async canAccessIncident(
    user: OperatorRequestUser,
    incidentId: string,
    prisma: { incident: { findFirst: (args: unknown) => Promise<{ id: string } | null> } }
  ): Promise<boolean> {
    if (this.isAdmin(user)) {
      return true;
    }
    const where = this.incidentWhere(user);
    const row = await prisma.incident.findFirst({
      where: { id: incidentId, ...where },
      select: { id: true },
    });
    return row !== null;
  }

  async canAccessTeam(
    user: OperatorRequestUser,
    teamId: string,
    prisma: { team: { findFirst: (args: unknown) => Promise<{ id: string } | null> } }
  ): Promise<boolean> {
    if (this.isAdmin(user)) {
      return true;
    }
    const where = this.teamWhere(user);
    const row = await prisma.team.findFirst({
      where: { id: teamId, ...where },
      select: { id: true },
    });
    return row !== null;
  }
}
