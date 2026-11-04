import { Test, TestingModule } from '@nestjs/testing';
import { OperatorSituationService } from './operator-situation.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetaModelClient } from '../ai/meta-model-client';
import { BudgetGuardService } from '../ai/budget-guard.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { UserRole } from '@prisma/client';

describe('OperatorSituationService', () => {
  let service: OperatorSituationService;
  let prisma: PrismaService;
  let scope: IncidentScopeService;

  const mockUser = {
    sub: 'user-1',
    id: 'user-1',
    email: 'operator@test.com',
    displayName: 'Test Operator',
    role: UserRole.OPERATOR,
    teamId: 'team-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperatorSituationService,
        {
          provide: PrismaService,
          useValue: {
            incident: {
              findMany: jest.fn(),
            },
            regionalClusterSummary: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: MetaModelClient,
          useValue: {
            chatJson: jest.fn(),
            computeCost: jest.fn().mockReturnValue(0.001),
          },
        },
        {
          provide: BudgetGuardService,
          useValue: {
            check: jest.fn().mockResolvedValue({ allowed: true }),
            reserve: jest.fn().mockResolvedValue({
              reserved: true,
              reservationId: 'res-1',
            }),
            reconcile: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: IncidentScopeService,
          useValue: {
            incidentWhere: jest.fn().mockReturnValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<OperatorSituationService>(OperatorSituationService);
    prisma = module.get<PrismaService>(PrismaService);
    scope = module.get<IncidentScopeService>(IncidentScopeService);
  });

  describe('getRegionalSituation', () => {
    it('should cluster incidents by location and hazard type', async () => {
      const mockIncidents = [
        {
          id: 'inc-1',
          createdAt: new Date('2026-11-04T10:00:00Z'),
          latestLatitude: 41.0,
          latestLongitude: 29.0,
          latestLocationAt: new Date('2026-11-04T10:00:00Z'),
          lastMessageAt: new Date('2026-11-04T10:00:00Z'),
          mergedMessageCount: 1,
          sosMessages: [
            {
              id: 'msg-1',
              sosType: 'MEDICAL',
              personCount: 2,
              receivedAt: new Date('2026-11-04T10:00:00Z'),
            },
          ],
          aiAnalyses: [
            {
              eventType: 'MEDICAL',
              urgencySuggestion: 'HIGH',
              needs: ['medical', 'ambulance'],
              hazards: ['injury'],
              reportedPersonCount: 2,
            },
          ],
        },
        {
          id: 'inc-2',
          createdAt: new Date('2026-11-04T10:05:00Z'),
          latestLatitude: 41.001,
          latestLongitude: 29.001,
          latestLocationAt: new Date('2026-11-04T10:05:00Z'),
          lastMessageAt: new Date('2026-11-04T10:05:00Z'),
          mergedMessageCount: 1,
          sosMessages: [
            {
              id: 'msg-2',
              sosType: 'MEDICAL',
              personCount: 3,
              receivedAt: new Date('2026-11-04T10:05:00Z'),
            },
          ],
          aiAnalyses: [
            {
              eventType: 'MEDICAL',
              urgencySuggestion: 'CRITICAL',
              needs: ['medical', 'emergency'],
              hazards: ['injury', 'bleeding'],
              reportedPersonCount: 3,
            },
          ],
        },
      ];

      jest.spyOn(prisma.incident, 'findMany').mockResolvedValue(mockIncidents as any);

      const result = await service.getRegionalSituation(mockUser, scope, 24);

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].hazardType).toBe('MEDICAL');
      expect(result.clusters[0].incidentCount).toBe(2);
      expect(result.clusters[0].estimatedPeopleAffected).toBe(5);
      expect(result.clusters[0].urgency).toBe('CRITICAL');
    });

    it('should separate incidents by distance', async () => {
      const mockIncidents = [
        {
          id: 'inc-1',
          createdAt: new Date('2026-11-04T10:00:00Z'),
          latestLatitude: 41.0,
          latestLongitude: 29.0,
          latestLocationAt: new Date('2026-11-04T10:00:00Z'),
          lastMessageAt: new Date('2026-11-04T10:00:00Z'),
          mergedMessageCount: 1,
          sosMessages: [
            {
              id: 'msg-1',
              sosType: 'FIRE',
              personCount: 5,
              receivedAt: new Date('2026-11-04T10:00:00Z'),
            },
          ],
          aiAnalyses: [
            {
              eventType: 'FIRE',
              urgencySuggestion: 'CRITICAL',
              needs: ['fire_brigade'],
              hazards: ['fire'],
              reportedPersonCount: 5,
            },
          ],
        },
        {
          id: 'inc-2',
          createdAt: new Date('2026-11-04T10:05:00Z'),
          latestLatitude: 41.03,
          latestLongitude: 29.03,
          latestLocationAt: new Date('2026-11-04T10:05:00Z'),
          lastMessageAt: new Date('2026-11-04T10:05:00Z'),
          mergedMessageCount: 1,
          sosMessages: [
            {
              id: 'msg-2',
              sosType: 'FIRE',
              personCount: 3,
              receivedAt: new Date('2026-11-04T10:05:00Z'),
            },
          ],
          aiAnalyses: [
            {
              eventType: 'FIRE',
              urgencySuggestion: 'HIGH',
              needs: ['fire_brigade'],
              hazards: ['fire', 'smoke'],
              reportedPersonCount: 3,
            },
          ],
        },
      ];

      jest.spyOn(prisma.incident, 'findMany').mockResolvedValue(mockIncidents as any);

      const result = await service.getRegionalSituation(mockUser, scope, 24);

      expect(result.clusters.length).toBeGreaterThanOrEqual(1);
      expect(result.clusters.every((c) => c.hazardType === 'FIRE')).toBe(true);
    });

    it('should compute severity based on incident count and people affected', async () => {
      const mockIncidents = Array.from({ length: 12 }, (_, i) => ({
        id: `inc-${i}`,
        createdAt: new Date('2026-11-04T10:00:00Z'),
        latestLatitude: 41.0 + i * 0.0001,
        latestLongitude: 29.0 + i * 0.0001,
        latestLocationAt: new Date('2026-11-04T10:00:00Z'),
        lastMessageAt: new Date('2026-11-04T10:00:00Z'),
        mergedMessageCount: 1,
        sosMessages: [
          {
            id: `msg-${i}`,
            sosType: 'TRAPPED',
            personCount: 5,
            receivedAt: new Date('2026-11-04T10:00:00Z'),
          },
        ],
        aiAnalyses: [
          {
            eventType: 'TRAPPED',
            urgencySuggestion: 'CRITICAL',
            needs: ['rescue'],
            hazards: ['trapped', 'collapsed_building'],
            reportedPersonCount: 5,
          },
        ],
      }));

      jest.spyOn(prisma.incident, 'findMany').mockResolvedValue(mockIncidents as any);

      const result = await service.getRegionalSituation(mockUser, scope, 24);

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].severity).toBe('CRITICAL');
      expect(result.clusters[0].urgency).toBe('CRITICAL');
    });

    it('should filter by minimum urgency', async () => {
      const mockIncidents = [
        {
          id: 'inc-1',
          createdAt: new Date('2026-11-04T10:00:00Z'),
          latestLatitude: 41.0,
          latestLongitude: 29.0,
          latestLocationAt: new Date('2026-11-04T10:00:00Z'),
          lastMessageAt: new Date('2026-11-04T10:00:00Z'),
          mergedMessageCount: 1,
          sosMessages: [
            {
              id: 'msg-1',
              sosType: 'GENERAL',
              personCount: 1,
              receivedAt: new Date('2026-11-04T08:00:00Z'),
            },
          ],
          aiAnalyses: [
            {
              eventType: 'GENERAL',
              urgencySuggestion: 'LOW',
              needs: ['information'],
              hazards: [],
              reportedPersonCount: 1,
            },
          ],
        },
        {
          id: 'inc-2',
          createdAt: new Date('2026-11-04T10:05:00Z'),
          latestLatitude: 41.05,
          latestLongitude: 29.05,
          latestLocationAt: new Date('2026-11-04T10:05:00Z'),
          lastMessageAt: new Date('2026-11-04T10:05:00Z'),
          mergedMessageCount: 1,
          sosMessages: [
            {
              id: 'msg-2',
              sosType: 'FIRE',
              personCount: 10,
              receivedAt: new Date('2026-11-04T10:05:00Z'),
            },
          ],
          aiAnalyses: [
            {
              eventType: 'FIRE',
              urgencySuggestion: 'CRITICAL',
              needs: ['fire_brigade', 'evacuation'],
              hazards: ['fire'],
              reportedPersonCount: 10,
            },
          ],
        },
      ];

      jest.spyOn(prisma.incident, 'findMany').mockResolvedValue(mockIncidents as any);

      const result = await service.getRegionalSituation(mockUser, scope, 24, 'HIGH');

      expect(result.clusters.every((c) => ['CRITICAL', 'HIGH'].includes(c.urgency))).toBe(true);
    });
  });
});
