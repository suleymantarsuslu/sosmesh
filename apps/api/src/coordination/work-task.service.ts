import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  UserRole,
  WorkTaskSource,
  WorkTaskStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';
import { NotificationDispatchService } from '../notifications/notification-dispatch.service';
import {
  assertTaskTransition,
  assertWorkTaskVersion,
  lockWorkTaskTransaction,
} from './work-task-version.util';

export type WorkTaskDto = {
  id: string;
  incidentId: string;
  teamId: string;
  resourceId: string | null;
  assigneeId: string | null;
  assigneeDisplayName: string | null;
  title: string;
  description: string | null;
  status: WorkTaskStatus;
  source: WorkTaskSource;
  version: number;
  createdAt: string;
  updatedAt: string;
};

function mapTask(row: {
  id: string;
  incidentId: string;
  teamId: string;
  resourceId: string | null;
  assigneeId: string | null;
  title: string;
  description: string | null;
  status: WorkTaskStatus;
  source: WorkTaskSource;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  assignee: { displayName: string } | null;
}): WorkTaskDto {
  return {
    id: row.id,
    incidentId: row.incidentId,
    teamId: row.teamId,
    resourceId: row.resourceId,
    assigneeId: row.assigneeId,
    assigneeDisplayName: row.assignee?.displayName ?? null,
    title: row.title,
    description: row.description,
    status: row.status,
    source: row.source,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class WorkTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService,
    private readonly notifications: NotificationDispatchService
  ) {}

  private assertCoordinator(user: OperatorRequestUser): void {
    if (user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only coordinators can modify tasks',
      });
    }
  }

  async listTasks(
    user: OperatorRequestUser,
    query: { incidentId?: string; status?: WorkTaskStatus }
  ): Promise<{ items: WorkTaskDto[] }> {
    const scopeWhere = this.scope.workTaskWhere(user);
    const rows = await this.prisma.workTask.findMany({
      where: {
        ...scopeWhere,
        ...(query.incidentId ? { incidentId: query.incidentId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { assignee: { select: { displayName: true } } },
    });
    return { items: rows.map(mapTask) };
  }

  async createTask(
    user: OperatorRequestUser,
    input: {
      incidentId: string;
      teamId: string;
      resourceId?: string;
      assigneeId?: string;
      title: string;
      description?: string;
      source?: WorkTaskSource;
    }
  ): Promise<WorkTaskDto> {
    this.assertCoordinator(user);
    const source = input.source ?? WorkTaskSource.MANUAL;
    if (source === WorkTaskSource.AI) {
      throw new BadRequestException({
        code: 'AI_DRAFT_ONLY',
        message: 'Use ai-draft endpoint for AI-sourced proposals',
      });
    }

    const allowedIncident = await this.scope.canAccessIncident(
      user,
      input.incidentId,
      this.prisma
    );
    if (!allowedIncident) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }
    const teamOk = await this.scope.canAccessTeam(user, input.teamId, this.prisma);
    if (!teamOk) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Team not found' });
    }

    let status: WorkTaskStatus = WorkTaskStatus.PROPOSED;
    if (input.assigneeId) {
      status = WorkTaskStatus.ASSIGNED;
    }

    const task = await this.prisma.$transaction(async (tx) => {
      if (input.resourceId) {
        const resource = await tx.resource.findFirst({
          where: {
            id: input.resourceId,
            organizationId: user.organizationId ?? undefined,
          },
        });
        if (!resource) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
        }
      }

      const created = await tx.workTask.create({
        data: {
          incidentId: input.incidentId,
          teamId: input.teamId,
          resourceId: input.resourceId,
          assigneeId: input.assigneeId,
          title: input.title,
          description: input.description,
          status,
          source: WorkTaskSource.MANUAL,
        },
        include: { assignee: { select: { displayName: true } } },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          incidentId: input.incidentId,
          action: 'work_task.create',
          detailsJson: {
            taskId: created.id,
            before: null,
            after: {
              status: created.status,
              source: created.source,
              assigneeId: created.assigneeId,
              teamId: created.teamId,
            },
          },
        },
      });

      return created;
    });

    await this.notifications.notifyTaskEvent(user, task, 'work_task.created');
    return mapTask(task);
  }

  async createAiDraft(
    user: OperatorRequestUser,
    input: {
      incidentId: string;
      teamId: string;
      title: string;
      description?: string;
      resourceId?: string;
    }
  ): Promise<WorkTaskDto> {
    this.assertCoordinator(user);
    const allowedIncident = await this.scope.canAccessIncident(
      user,
      input.incidentId,
      this.prisma
    );
    if (!allowedIncident) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.workTask.create({
        data: {
          incidentId: input.incidentId,
          teamId: input.teamId,
          resourceId: input.resourceId,
          title: input.title,
          description: input.description,
          status: WorkTaskStatus.PROPOSED,
          source: WorkTaskSource.AI,
        },
        include: { assignee: { select: { displayName: true } } },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          incidentId: input.incidentId,
          action: 'work_task.ai_draft',
          detailsJson: {
            taskId: created.id,
            before: null,
            after: { status: WorkTaskStatus.PROPOSED, source: WorkTaskSource.AI },
          },
        },
      });

      return created;
    });

    return mapTask(task);
  }

  async assignTask(
    user: OperatorRequestUser,
    taskId: string,
    input: { assigneeId: string; expectedVersion: number }
  ): Promise<WorkTaskDto> {
    this.assertCoordinator(user);
    return this.transitionTask(user, taskId, {
      expectedVersion: input.expectedVersion,
      nextStatus: WorkTaskStatus.ASSIGNED,
      assigneeId: input.assigneeId,
      action: 'work_task.assign',
    });
  }

  async withdrawTask(
    user: OperatorRequestUser,
    taskId: string,
    input: { expectedVersion: number }
  ): Promise<WorkTaskDto> {
    this.assertCoordinator(user);
    return this.transitionTask(user, taskId, {
      expectedVersion: input.expectedVersion,
      nextStatus: WorkTaskStatus.WITHDRAWN,
      action: 'work_task.withdraw',
    });
  }

  async closeTask(
    user: OperatorRequestUser,
    taskId: string,
    input: { expectedVersion: number }
  ): Promise<WorkTaskDto> {
    this.assertCoordinator(user);
    return this.transitionTask(user, taskId, {
      expectedVersion: input.expectedVersion,
      nextStatus: WorkTaskStatus.CLOSED,
      action: 'work_task.close',
    });
  }

  async acceptTask(
    user: OperatorRequestUser,
    taskId: string,
    input: { expectedVersion: number }
  ): Promise<WorkTaskDto> {
    this.assertCoordinator(user);
    return this.transitionTask(user, taskId, {
      expectedVersion: input.expectedVersion,
      nextStatus: WorkTaskStatus.ACCEPTED,
      action: 'work_task.accept',
    });
  }

  private async transitionTask(
    user: OperatorRequestUser,
    taskId: string,
    params: {
      expectedVersion: number;
      nextStatus: WorkTaskStatus;
      assigneeId?: string;
      action: string;
    }
  ): Promise<WorkTaskDto> {
    const scopeWhere = this.scope.workTaskWhere(user);
    const existing = await this.prisma.workTask.findFirst({
      where: { id: taskId, ...scopeWhere },
      include: { assignee: { select: { displayName: true } } },
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found' });
    }

    if (existing.source === WorkTaskSource.AI && params.nextStatus === WorkTaskStatus.ASSIGNED) {
      if (!params.assigneeId) {
        throw new BadRequestException({
          code: 'ASSIGNEE_REQUIRED',
          message: 'Coordinator must set a responsible assignee when approving an AI draft',
        });
      }
    }

    assertTaskTransition(existing.status, params.nextStatus);

    const task = await this.prisma.$transaction(async (tx) => {
      await lockWorkTaskTransaction(tx, taskId);
      await assertWorkTaskVersion(tx, taskId, params.expectedVersion);

      const before = {
        status: existing.status,
        assigneeId: existing.assigneeId,
      };

      const assigneeId =
        params.nextStatus === WorkTaskStatus.ASSIGNED
          ? params.assigneeId ?? existing.assigneeId
          : existing.assigneeId;

      if (params.nextStatus === WorkTaskStatus.ASSIGNED && !assigneeId) {
        throw new BadRequestException({
          code: 'ASSIGNEE_REQUIRED',
          message: 'Assigned tasks require a responsible assignee',
        });
      }

      const updated = await tx.workTask.update({
        where: { id: taskId },
        data: {
          status: params.nextStatus,
          assigneeId,
        },
        include: { assignee: { select: { displayName: true } } },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          incidentId: existing.incidentId,
          action: params.action,
          detailsJson: {
            taskId,
            before,
            after: { status: updated.status, assigneeId: updated.assigneeId },
          },
        },
      });

      return updated;
    });

    await this.notifications.notifyTaskEvent(user, task, params.action);
    return mapTask(task);
  }
}
