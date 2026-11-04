import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OperatorReviewStatus, UserRole, WorkTaskStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import { WorkTaskService } from './work-task.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';

describe('WorkTaskService - Task Completion and Auto Status', () => {
  let service: WorkTaskService;
  let prisma: PrismaService;

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
        WorkTaskService,
        {
          provide: PrismaService,
          useValue: {
            workTask: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            incident: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
            team: {
              findFirst: jest.fn(),
            },
            user: {
              findFirst: jest.fn(),
            },
            $executeRaw: jest.fn(),
            $transaction: jest.fn((cb) => {
              const tx = {
                workTask: {
                  ...prisma.workTask,
                  findUnique: jest.fn().mockResolvedValue({ version: 0 }),
                  updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                  count: jest.fn().mockResolvedValue(1),
                },
                incident: prisma.incident,
                auditLog: prisma.auditLog,
                team: prisma.team,
                user: prisma.user,
                $executeRaw: jest.fn(),
              };
              return cb(tx);
            }),
          },
        },
        {
          provide: IncidentScopeService,
          useValue: {
            workTaskWhere: jest.fn(() => ({ team: { organizationId: 'org-1' } })),
            teamWhere: jest.fn(() => ({ organizationId: 'org-1' })),
            canAccessIncident: jest.fn(() => Promise.resolve(true)),
            canAccessTeam: jest.fn(() => Promise.resolve(true)),
          },
        },
        {
          provide: NotificationDispatchService,
          useValue: {
            notifyTaskEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkTaskService>(WorkTaskService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('completeTask', () => {
    it('should mark task as completed with completedAt and completedById', async () => {
      const mockTask = {
        id: 'task-1',
        incidentId: 'incident-1',
        teamId: 'team-1',
        assigneeId: 'user-2',
        status: WorkTaskStatus.ASSIGNED,
        version: 0,
        team: { name: 'Team A', organizationId: 'org-1' },
        assignee: { displayName: 'John' },
        completedBy: null,
        completedAt: null,
        completedById: null,
        resourceId: null,
        title: 'Test task',
        description: null,
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.workTask.findFirst as jest.Mock).mockResolvedValue(mockTask);
      (prisma.workTask.update as jest.Mock).mockResolvedValue({
        ...mockTask,
        status: WorkTaskStatus.CLOSED,
        completedAt: new Date(),
        completedById: mockCoordinator.sub,
      });

      const result = await service.completeTask(mockCoordinator, 'task-1', { expectedVersion: 0 });

      expect(result.status).toBe(WorkTaskStatus.CLOSED);
      expect(result.completedById).toBe(mockCoordinator.sub);
      expect(result.completedAt).toBeDefined();
    });

    it('should deny completion by non-coordinator operator', async () => {
      const mockTask = {
        id: 'task-1',
        incidentId: 'incident-1',
        teamId: 'team-1',
        assigneeId: 'user-3',
        status: WorkTaskStatus.ASSIGNED,
        version: 0,
        team: { name: 'Team A', organizationId: 'org-1' },
        assignee: { displayName: 'Other' },
        completedBy: null,
        completedAt: null,
        completedById: null,
        resourceId: null,
        title: 'Test task',
        description: null,
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.workTask.findFirst as jest.Mock).mockResolvedValue(mockTask);

      await expect(
        service.completeTask(mockOperator, 'task-1', { expectedVersion: 0 })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assignTask - Auto COORDINATING status', () => {
    it('should set incident reviewStatus to COORDINATING when task is assigned', async () => {
      const mockTask = {
        id: 'task-1',
        incidentId: 'incident-1',
        teamId: 'team-1',
        assigneeId: null,
        status: WorkTaskStatus.PROPOSED,
        version: 0,
        team: { name: 'Team A', organizationId: 'org-1' },
        assignee: null,
        completedBy: null,
        completedAt: null,
        completedById: null,
        resourceId: null,
        title: 'Test task',
        description: null,
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockIncident = {
        reviewStatus: OperatorReviewStatus.UNDER_REVIEW,
        version: 5,
      };

      (prisma.workTask.findFirst as jest.Mock).mockResolvedValue(mockTask);
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({
        id: 'team-1',
        organizationId: 'org-1',
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-2' });
      (prisma.workTask.update as jest.Mock).mockResolvedValue({
        ...mockTask,
        status: WorkTaskStatus.ASSIGNED,
        assigneeId: 'user-2',
        assignee: { displayName: 'John' },
      });
      (prisma.incident.findUnique as jest.Mock).mockResolvedValue(mockIncident);
      (prisma.incident.update as jest.Mock).mockResolvedValue({
        ...mockIncident,
        reviewStatus: OperatorReviewStatus.COORDINATING,
      });

      await service.assignTask(mockCoordinator, 'task-1', {
        assigneeId: 'user-2',
        expectedVersion: 0,
      });

      expect(prisma.incident.update).toHaveBeenCalledWith({
        where: { id: 'incident-1' },
        data: {
          reviewStatus: OperatorReviewStatus.COORDINATING,
          version: { increment: 1 },
        },
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REVIEW_STATUS_CHANGED',
            incidentId: 'incident-1',
          }),
        })
      );
    });

    it('should not change reviewStatus if already COORDINATING', async () => {
      const mockTask = {
        id: 'task-1',
        incidentId: 'incident-1',
        teamId: 'team-1',
        assigneeId: null,
        status: WorkTaskStatus.PROPOSED,
        version: 0,
        team: { name: 'Team A', organizationId: 'org-1' },
        assignee: null,
        completedBy: null,
        completedAt: null,
        completedById: null,
        resourceId: null,
        title: 'Test task',
        description: null,
        source: 'MANUAL',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockIncident = {
        reviewStatus: OperatorReviewStatus.COORDINATING,
        version: 5,
      };

      (prisma.workTask.findFirst as jest.Mock).mockResolvedValue(mockTask);
      (prisma.team.findFirst as jest.Mock).mockResolvedValue({
        id: 'team-1',
        organizationId: 'org-1',
      });
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-2' });
      (prisma.workTask.update as jest.Mock).mockResolvedValue({
        ...mockTask,
        status: WorkTaskStatus.ASSIGNED,
        assigneeId: 'user-2',
        assignee: { displayName: 'John' },
      });
      (prisma.incident.findUnique as jest.Mock).mockResolvedValue(mockIncident);

      await service.assignTask(mockCoordinator, 'task-1', {
        assigneeId: 'user-2',
        expectedVersion: 0,
      });

      expect(prisma.incident.update).not.toHaveBeenCalled();
    });
  });
});
