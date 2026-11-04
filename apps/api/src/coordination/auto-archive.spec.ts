import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WorkTaskService } from './work-task.service';
import { WorkTaskScopeService } from './work-task-scope.service';
import { UserRole, WorkTaskStatus } from '@prisma/client';

describe('Auto-archive on task completion', () => {
  let service: WorkTaskService;

  const mockUser = {
    sub: 'user-1',
    role: UserRole.COORDINATOR,
    organizationId: 'org-1',
    email: 'test@example.com',
    displayName: 'Test User',
  };

  const mockIncidentScope = {
    organizationId: 'org-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkTaskService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn((callback) => callback(mockTx)),
            workTask: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            incident: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: WorkTaskScopeService,
          useValue: {
            workTaskWhere: jest.fn().mockReturnValue(mockIncidentScope),
            teamWhere: jest.fn().mockReturnValue(mockIncidentScope),
          },
        },
      ],
    }).compile();

    service = module.get<WorkTaskService>(WorkTaskService);
  });

  const mockTx = {
    workTask: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    incident: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  it('should auto-archive incident when last task is completed', async () => {
    const taskId = 'task-1';
    const incidentId = 'inc-1';

    mockTx.workTask.findUnique.mockResolvedValue({
      id: taskId,
      incidentId,
      status: WorkTaskStatus.ASSIGNED,
      assigneeId: 'user-1',
      teamId: 'team-1',
      team: { name: 'Team A' },
    });

    mockTx.workTask.update.mockResolvedValue({
      id: taskId,
      status: WorkTaskStatus.CLOSED,
      completedAt: new Date(),
      completedById: mockUser.sub,
    });

    mockTx.workTask.count.mockResolvedValue(0);

    mockTx.incident.findUnique.mockResolvedValue({
      id: incidentId,
      deletedAt: null,
    });

    mockTx.incident.update.mockResolvedValue({
      id: incidentId,
      deletedAt: new Date(),
      archiveReason: 'completed',
    });

    await service.completeTask(mockUser, taskId);

    expect(mockTx.incident.update).toHaveBeenCalledWith({
      where: { id: incidentId },
      data: {
        deletedAt: expect.any(Date),
        archiveReason: 'completed',
      },
    });

    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'INCIDENT_AUTO_ARCHIVED',
        detailsJson: expect.objectContaining({
          reason: 'all_tasks_completed',
          lastTaskId: taskId,
        }),
      }),
    });
  });

  it('should not archive when other active tasks remain', async () => {
    const taskId = 'task-1';
    const incidentId = 'inc-1';

    mockTx.workTask.findUnique.mockResolvedValue({
      id: taskId,
      incidentId,
      status: WorkTaskStatus.ASSIGNED,
      assigneeId: 'user-1',
      teamId: 'team-1',
      team: { name: 'Team A' },
    });

    mockTx.workTask.update.mockResolvedValue({
      id: taskId,
      status: WorkTaskStatus.CLOSED,
      completedAt: new Date(),
      completedById: mockUser.sub,
    });

    mockTx.workTask.count.mockResolvedValue(2);

    await service.completeTask(mockUser, taskId);

    expect(mockTx.incident.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          archiveReason: expect.anything(),
        }),
      })
    );
  });
});
