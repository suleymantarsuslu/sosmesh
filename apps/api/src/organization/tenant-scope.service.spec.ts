import { TenantScopeService } from './tenant-scope.service';
import { UserRole } from '@prisma/client';
import type { OperatorRequestUser } from '../operator/guards/operator-auth.guard';

describe('TenantScopeService', () => {
  let service: TenantScopeService;

  beforeEach(() => {
    service = new TenantScopeService();
  });

  describe('incidentWhere', () => {
    it('should return undefined for ADMIN role', () => {
      const user: OperatorRequestUser = {
        id: 'user-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
        teamId: 'team-1',
        organizationId: 'org-1',
      };

      const result = service.incidentWhere(user);
      expect(result).toBeUndefined();
    });

    it('should include unassigned incidents for OPERATOR role', () => {
      const user: OperatorRequestUser = {
        id: 'user-1',
        email: 'operator@example.com',
        role: UserRole.OPERATOR,
        teamId: 'team-1',
        organizationId: 'org-1',
      };

      const result = service.incidentWhere(user);
      expect(result).toEqual({
        OR: [
          {
            assignments: {
              some: {
                teamId: 'team-1',
                team: {
                  organizationId: 'org-1',
                },
              },
            },
          },
          {
            assignments: {
              none: {},
            },
          },
        ],
      });
    });

    it('should include unassigned incidents for COORDINATOR role', () => {
      const user: OperatorRequestUser = {
        id: 'user-1',
        email: 'coordinator@example.com',
        role: UserRole.COORDINATOR,
        teamId: 'team-1',
        organizationId: 'org-1',
      };

      const result = service.incidentWhere(user);
      expect(result).toEqual({
        OR: [
          {
            assignments: {
              some: {
                team: {
                  organizationId: 'org-1',
                },
              },
            },
          },
          {
            assignments: {
              none: {},
            },
          },
        ],
      });
    });

    it('should return empty result set when teamId or organizationId is missing', () => {
      const user: OperatorRequestUser = {
        id: 'user-1',
        email: 'operator@example.com',
        role: UserRole.OPERATOR,
        teamId: null,
        organizationId: 'org-1',
      };

      const result = service.incidentWhere(user);
      expect(result).toEqual({ id: { in: [] } });
    });
  });
});
