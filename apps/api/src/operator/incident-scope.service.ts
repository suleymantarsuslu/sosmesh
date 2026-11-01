import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { OperatorRequestUser } from './guards/operator-auth.guard';

@Injectable()
export class IncidentScopeService {
  isAdmin(user: OperatorRequestUser): boolean {
    return user.role === UserRole.ADMIN;
  }

  incidentWhere(user: OperatorRequestUser): Prisma.IncidentWhereInput | undefined {
    if (this.isAdmin(user)) {
      return undefined;
    }
    if (!user.teamId) {
      return { id: { in: [] } };
    }
    return {
      assignments: {
        some: { teamId: user.teamId },
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
