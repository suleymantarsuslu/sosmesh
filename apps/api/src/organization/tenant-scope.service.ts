import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';

@Injectable()
export class TenantScopeService {
  isAdmin(user: OperatorRequestUser): boolean {
    return user.role === UserRole.ADMIN;
  }

  incidentWhere(user: OperatorRequestUser): Prisma.IncidentWhereInput | undefined {
    if (this.isAdmin(user)) {
      return undefined;
    }

    if (!user.teamId || !user.organizationId) {
      return { id: { in: [] } };
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
}
