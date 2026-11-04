import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OperatorReviewStatus,
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
  teamName: string | null;
  resourceId: string | null;
  assigneeId: string | null;
  assigneeDisplayName: string | null;
  completedById: string | null;
  completedByDisplayName: string | null;
  completedAt: string | null;
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
  completedById: string | null;
  completedAt: Date | null;
  title: string;
  description: string | null;
  status: WorkTaskStatus;
  source: WorkTaskSource;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  assignee: { displayName: string } | null;
  completedBy?: { displayName: string } | null;
  team?: { name: string } | null;
}): WorkTaskDto {
  return {
    id: row.id,
    incidentId: row.incidentId,
    teamId: row.teamId,
    teamName: row.team?.name ?? null,
    resourceId: row.resourceId,
    assigneeId: row.assigneeId,
    assigneeDisplayName: row.assignee?.displayName ?? null,
    completedById: row.completedById,
    completedByDisplayName: row.completedBy?.displayName ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    title: row.title,
    description: row.description,
    status: row.status,
    source: row.source,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const TASK_INCLUDE = {
  assignee: { select: { displayName: true } },
  completedBy: { select: { displayName: true } },
  team: { select: { name: true } },
} as const;

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

  private assertAssigneeOrCoordinator(
    user: OperatorRequestUser,
    task: { assigneeId: string | null },
    nextStatus: WorkTaskStatus
  ): void {
    if (
      nextStatus !== WorkTaskStatus.ACCEPTED &&
      nextStatus !== WorkTaskStatus.WITHDRAWN &&
      nextStatus !== WorkTaskStatus.CLOSED
    ) {
      this.assertCoordinator(user);
      return;
    }
    const isCoordinator =
      user.role === UserRole.COORDINATOR || user.role === UserRole.ADMIN;
    const isAssignee = task.assigneeId !== null && user.sub === task.assigneeId;
    if (!isCoordinator && !isAssignee) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the assignee or a coordinator can update this task',
      });
    }
  }

  private async assertAssigneeForTeam(
    user: OperatorRequestUser,
    teamId: string,
    assigneeId: string,
    db: PrismaService | Parameters<Parameters<PrismaService['$transaction']>[0]>[0]
  ): Promise<void> {
    const teamScope = this.scope.teamWhere(user);
    const team = await db.team.findFirst({
      where: { id: teamId, ...teamScope },
      select: { id: true, organizationId: true },
    });
    if (!team) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Team not found' });
    }
    const assignee = await db.user.findFirst({
      where: {
        id: assigneeId,
        teamId: team.id,
        team: { organizationId: team.organizationId },
      },
      select: { id: true },
    });
    if (!assignee) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Assignee not found' });
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
      include: TASK_INCLUDE,
    });
    return { items: rows.map(mapTask) };
  }

  async listTaskHistory(
    user: OperatorRequestUser
  ): Promise<{ items: WorkTaskDto[] }> {
    const scopeWhere = this.scope.workTaskWhere(user);
    const rows = await this.prisma.workTask.findMany({
      where: {
        ...scopeWhere,
        status: { in: [WorkTaskStatus.CLOSED, WorkTaskStatus.WITHDRAWN] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: TASK_INCLUDE,
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

    if (input.assigneeId) {
      await this.assertAssigneeForTeam(user, input.teamId, input.assigneeId, this.prisma);
    }

    let status: WorkTaskStatus = WorkTaskStatus.PROPOSED;
    if (input.assigneeId) {
      status = WorkTaskStatus.ASSIGNED;
    }

    const resourceScope = this.scope.resourceWhere(user);

    const task = await this.prisma.$transaction(async (tx) => {
      if (input.resourceId) {
        const resource = await tx.resource.findFirst({
          where: {
            id: input.resourceId,
            ...resourceScope,
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
        include: TASK_INCLUDE,
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
    const teamOk = await this.scope.canAccessTeam(user, input.teamId, this.prisma);
    if (!teamOk) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Team not found' });
    }
    if (input.resourceId) {
      const resourceScope = this.scope.resourceWhere(user);
      const resource = await this.prisma.resource.findFirst({
        where: { id: input.resourceId, ...resourceScope },
      });
      if (!resource) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Resource not found' });
      }
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
        include: TASK_INCLUDE,
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

  /**
   * Sends a task to a whole team (status ASSIGNED, no individual assignee). Used when a coordinator
   * confirms an assignment recommendation for a team; the team lead can then accept or delegate.
   */
  async assignTaskToTeam(
    user: OperatorRequestUser,
    taskId: string,
    input: { expectedVersion: number }
  ): Promise<WorkTaskDto> {
    this.assertCoordinator(user);
    return this.transitionTask(user, taskId, {
      expectedVersion: input.expectedVersion,
      nextStatus: WorkTaskStatus.ASSIGNED,
      teamLevel: true,
      action: 'work_task.assign_team',
    });
  }

  async withdrawTask(
    user: OperatorRequestUser,
    taskId: string,
    input: { expectedVersion: number }
  ): Promise<WorkTaskDto> {
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
    return this.transitionTask(user, taskId, {
      expectedVersion: input.expectedVersion,
      nextStatus: WorkTaskStatus.CLOSED,
      action: 'work_task.close',
    });
  }

  async completeTask(
    user: OperatorRequestUser,
    taskId: string,
    input: { expectedVersion: number }
  ): Promise<WorkTaskDto> {
    return this.transitionTask(user, taskId, {
      expectedVersion: input.expectedVersion,
      nextStatus: WorkTaskStatus.CLOSED,
      action: 'work_task.complete',
      markCompleted: true,
    });
  }

  async acceptTask(
    user: OperatorRequestUser,
    taskId: string,
    input: { expectedVersion: number }
  ): Promise<WorkTaskDto> {
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
      /** Team-level assignment: ASSIGNED without an individual assignee. */
      teamLevel?: boolean;
      /** Mark as completed with timestamp and completedBy user. */
      markCompleted?: boolean;
      action: string;
    }
  ): Promise<WorkTaskDto> {
    const scopeWhere = this.scope.workTaskWhere(user);
    const existing = await this.prisma.workTask.findFirst({
      where: { id: taskId, ...scopeWhere },
      include: TASK_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Task not found' });
    }

    this.assertAssigneeOrCoordinator(user, existing, params.nextStatus);

    if (params.nextStatus === WorkTaskStatus.ASSIGNED && params.assigneeId) {
      await this.assertAssigneeForTeam(user, existing.teamId, params.assigneeId, this.prisma);
    }

    if (
      existing.source === WorkTaskSource.AI &&
      params.nextStatus === WorkTaskStatus.ASSIGNED &&
      !params.teamLevel
    ) {
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

      if (params.nextStatus === WorkTaskStatus.ASSIGNED && !assigneeId && !params.teamLevel) {
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
          ...(params.markCompleted
            ? { completedAt: new Date(), completedById: user.sub }
            : {}),
        },
        include: TASK_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          incidentId: existing.incidentId,
          action: params.action,
          detailsJson: {
            taskId,
            before,
            after: {
              status: updated.status,
              assigneeId: updated.assigneeId,
              teamId: updated.teamId,
              teamName: updated.team.name,
            },
          },
        },
      });

      if (params.nextStatus === WorkTaskStatus.ASSIGNED) {
        const incident = await tx.incident.findUnique({
          where: { id: existing.incidentId },
          select: { reviewStatus: true, version: true },
        });

        if (incident && incident.reviewStatus !== OperatorReviewStatus.COORDINATING) {
          await tx.incident.update({
            where: { id: existing.incidentId },
            data: {
              reviewStatus: OperatorReviewStatus.COORDINATING,
              version: { increment: 1 },
            },
          });

          await tx.auditLog.create({
            data: {
              actorId: user.sub,
              incidentId: existing.incidentId,
              action: 'REVIEW_STATUS_CHANGED',
              detailsJson: {
                before: incident.reviewStatus,
                after: OperatorReviewStatus.COORDINATING,
                reason: 'task_assigned',
              },
            },
          });
        }
      }

      return updated;
    });

    await this.notifications.notifyTaskEvent(user, task, params.action);
    return mapTask(task);
  }
}
