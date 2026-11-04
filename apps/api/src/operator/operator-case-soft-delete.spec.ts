import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorCaseActionsService } from './operator-case-actions.service';
import { OperatorCasesService } from './operator-cases.service';
import { MessageTranslationService } from '../ai/message-translation.service';
import { OperatorRequestUser } from './guards/operator-auth.guard';

describe('Incident Soft Delete', () => {
  let actionsService: OperatorCaseActionsService;
  let casesService: OperatorCasesService;
  let prisma: PrismaService;
  let scope: IncidentScopeService;

  const mockCoordinator: OperatorRequestUser = {
    sub: 'user-1',
    role: UserRole.COORDINATOR,
    organizationId: 'org-1',
    teamId: 'team-1',
  };

  const mockOperator: OperatorRequestUser = {
    sub: 'user-2',
    role: UserRole.OPERATOR,
    organizationId: 'org-1',
    teamId: 'team-1',
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OperatorCaseActionsService,
        OperatorCasesService,
        {
          provide: PrismaService,
          useValue: {
            incident: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            sosMessage: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            messageEvent: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: IncidentScopeService,
          useValue: {
            canAccessIncident: jest.fn(() => Promise.resolve(true)),
            incidentWhere: jest.fn(() => ({ assignments: { some: {} } })),
          },
        },
        {
          provide: MessageTranslationService,
          useValue: {
            translateMessage: jest.fn(() => Promise.resolve(null)),
            getTranscriptTranslationFields: jest.fn(() => Promise.resolve({})),
          },
        },
      ],
    }).compile();

    actionsService = module.get<OperatorCaseActionsService>(OperatorCaseActionsService);
    casesService = module.get<OperatorCasesService>(OperatorCasesService);
    prisma = module.get<PrismaService>(PrismaService);
    scope = module.get<IncidentScopeService>(IncidentScopeService);
  });

  describe('deleteIncident', () => {
    it('should soft-delete incident with deletedAt timestamp', async () => {
      const mockIncident = {
        id: 'incident-1',
        deletedAt: null,
      };

      (prisma.incident.findUnique as jest.Mock).mockResolvedValue(mockIncident);
      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        deletedAt: new Date(),
      });

      const result = await actionsService.deleteIncident(mockCoordinator, 'incident-1');

      expect(result.deleted).toBe(true);
      expect(result.deletedAt).toBeDefined();
      expect(prisma.incident.update).toHaveBeenCalledWith({
        where: { id: 'incident-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'INCIDENT_DELETED',
          incidentId: 'incident-1',
          actorId: mockCoordinator.sub,
        }),
      });
    });

    it('should deny deletion by non-coordinator operator', async () => {
      await expect(
        actionsService.deleteIncident(mockOperator, 'incident-1')
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('should reject deletion of already deleted incident', async () => {
      const mockIncident = {
        id: 'incident-1',
        deletedAt: new Date('2024-01-01'),
      };

      (prisma.incident.findUnique as jest.Mock).mockResolvedValue(mockIncident);

      await expect(
        actionsService.deleteIncident(mockCoordinator, 'incident-1')
      ).rejects.toThrow(BadRequestException);

      expect(prisma.incident.update).not.toHaveBeenCalled();
    });

    it('should reject deletion of non-existent incident', async () => {
      (scope.canAccessIncident as jest.Mock).mockResolvedValue(false);

      await expect(
        actionsService.deleteIncident(mockCoordinator, 'incident-1')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listCases - Filtering deleted incidents', () => {
    it('should exclude deleted incidents from active case list', async () => {
      const activeCases = [
        {
          id: 'msg-1',
          messageId: 'SOS-001',
          incidentId: 'incident-1',
          priority: 1,
          sosType: 'MEDICAL',
          deliveryState: 'OPERATOR_SEEN',
          locationStatus: 'GPS',
          latitude: null,
          longitude: null,
          accuracyMeters: null,
          preciseLatitude: { toNumber: () => 40.123 },
          preciseLongitude: { toNumber: () => 29.456 },
          preciseAccuracyMeters: 10,
          receivedAt: new Date(),
          incident: { state: 'IN_PROGRESS' },
          messageEvents: [{ source: 'device' }],
        },
      ];

      (prisma.sosMessage.findMany as jest.Mock).mockResolvedValue(activeCases);

      const result = await casesService.listCases(mockCoordinator, {
        cursor: undefined,
        limit: undefined,
      });

      expect(prisma.sosMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            incident: expect.objectContaining({
              deletedAt: null,
            }),
          }),
        })
      );

      expect(result.items.length).toBeGreaterThan(0);
    });
  });

  describe('listHistory - Including deleted incidents', () => {
    it('should include deleted incidents in history', async () => {
      const deletedIncidents = [
        {
          id: 'incident-1',
          state: 'RESOLVED',
          deletedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          sosMessages: [
            {
              id: 'msg-1',
              messageId: 'SOS-001',
              priority: 1,
              sosType: 'MEDICAL',
              receivedAt: new Date('2024-01-01'),
            },
          ],
        },
      ];

      (prisma.incident.findMany as jest.Mock).mockResolvedValue(deletedIncidents);

      const result = await casesService.listHistory(mockCoordinator);

      expect(prisma.incident.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: { not: null },
          }),
        })
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].deletedAt).toBeDefined();
    });
  });
});
