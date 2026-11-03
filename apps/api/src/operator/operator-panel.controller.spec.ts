import { Test, TestingModule } from '@nestjs/testing';
import { OperatorPanelController } from './operator-panel.controller';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorDashboardService } from './operator-dashboard.service';
import { OperatorCasesService } from './operator-cases.service';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { OperatorRequest } from './guards/operator-auth.guard';

describe('OperatorPanelController - UUID Validation', () => {
  let controller: OperatorPanelController;
  let casesService: OperatorCasesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperatorPanelController],
      providers: [
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: IncidentScopeService,
          useValue: {},
        },
        {
          provide: OperatorDashboardService,
          useValue: {},
        },
        {
          provide: OperatorCasesService,
          useValue: {
            getCaseDetail: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OperatorPanelController>(OperatorPanelController);
    casesService = module.get<OperatorCasesService>(OperatorCasesService);
  });

  describe('getCase with invalid UUID', () => {
    it('should reject malformed UUID with 400 BadRequest', async () => {
      const req: OperatorRequest = {
        operatorUser: {
          id: 'user-1',
          email: 'operator@example.com',
          role: UserRole.OPERATOR,
          teamId: 'team-1',
          organizationId: 'org-1',
        },
      };

      await expect(
        async () => {
          await (controller as any).getCase(req, 'not-a-uuid');
        }
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept valid UUID', async () => {
      const req: OperatorRequest = {
        operatorUser: {
          id: 'user-1',
          email: 'operator@example.com',
          role: UserRole.OPERATOR,
          teamId: 'team-1',
          organizationId: 'org-1',
        },
      };

      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      jest.spyOn(casesService, 'getCaseDetail').mockResolvedValue({
        incidentId: validUuid,
        incidentState: 'PENDING',
        messageId: 'msg-1',
        sosMessageId: 'sos-1',
        priority: 1,
        sosType: 'GENERAL',
        deliveryState: 'SERVER_ACCEPTED',
        locationStatus: 'UNKNOWN',
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        receivedAt: '2026-11-03T10:00:00.000Z',
        source: 'ingest',
        version: 0,
        reviewStatus: 'NEW',
        originalText: null,
        verifiedMetadata: {
          personCount: null,
          locationStatus: 'UNKNOWN',
          latitude: null,
          longitude: null,
          accuracyMeters: null,
        },
        ai: null,
        transcripts: [],
        timeline: [],
      });

      const result = await controller.getCase(req, validUuid);
      expect(result).toBeDefined();
      expect(result.incidentId).toBe(validUuid);
    });
  });
});
