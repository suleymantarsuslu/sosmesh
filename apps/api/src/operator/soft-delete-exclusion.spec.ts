import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OperatorPanelController } from './operator-panel.controller';
import { OperatorCasesService } from './operator-cases.service';
import { OperatorFeedService } from '../events/operator-feed.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { UserRole } from '@prisma/client';

describe('Soft-deleted incident exclusion', () => {
  let prisma: PrismaService;
  let panelController: OperatorPanelController;
  let casesService: OperatorCasesService;
  let feedService: OperatorFeedService;

  const mockUser = {
    sub: 'user-1',
    role: UserRole.COORDINATOR,
    organizationId: 'org-1',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OperatorPanelController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            incident: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            operatorFeedEvent: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: IncidentScopeService,
          useValue: {
            incidentWhere: jest.fn().mockReturnValue({ organizationId: 'org-1' }),
          },
        },
        OperatorCasesService,
        OperatorFeedService,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    panelController = module.get<OperatorPanelController>(OperatorPanelController);
    casesService = module.get<OperatorCasesService>(OperatorCasesService);
    feedService = module.get<OperatorFeedService>(OperatorFeedService);
  });

  describe('operator panel incident list', () => {
    it('should exclude soft-deleted incidents', async () => {
      const findManySpy = jest.spyOn(prisma.incident, 'findMany');

      await panelController.listIncidents({ operatorUser: mockUser } as any, undefined, undefined);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('operator feed service', () => {
    it('should exclude deleted incidents from feed', async () => {
      const findManySpy = jest.spyOn(prisma.incident, 'findMany').mockResolvedValue([
        { id: 'inc-1' },
        { id: 'inc-2' },
      ] as any);

      jest.spyOn(prisma.operatorFeedEvent, 'findMany').mockResolvedValue([]);

      await feedService.listAfter(mockUser, 0n, 50);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('case history', () => {
    it('should include archived incidents in history', async () => {
      const findManySpy = jest.spyOn(prisma.incident, 'findMany').mockResolvedValue([
        {
          id: 'inc-1',
          deletedAt: new Date(),
          archiveReason: 'completed',
          state: 'RESOLVED',
          createdAt: new Date(),
          updatedAt: new Date(),
          sosMessages: [],
        },
      ] as any);

      await casesService.listHistory(mockUser);

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: { not: null },
          }),
        })
      );
    });
  });
});
