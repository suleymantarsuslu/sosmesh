import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryState,
  OperatorReviewStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { validateSosAiOutput } from '../ai/schemas/sos-ai-output.schema';
import { canTransitionDelivery } from './delivery-state.util';
import { OperatorRequestUser } from './guards/operator-auth.guard';
import { IncidentScopeService } from './incident-scope.service';
import {
  assertIncidentVersionAndIncrement,
  lockIncidentTransaction,
} from './incident-version.util';
import {
  buildMetadataCorrectionUpdate,
  type MetadataCorrectionInput,
} from './metadata-correction.util';
import { canTransitionReview } from './review-status.util';

export type OperatorCaseAuditEntry = {
  id: string;
  action: string;
  actorId: string | null;
  actorDisplayName: string | null;
  createdAt: string;
  before: unknown;
  after: unknown;
};

@Injectable()
export class OperatorCaseActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService
  ) {}

  async recordOperatorSeen(
    user: OperatorRequestUser,
    incidentId: string
  ): Promise<{ created: boolean; messageEventId: string | null }> {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const message = await this.prisma.sosMessage.findFirst({
      where: { incidentId },
      orderBy: { receivedAt: 'desc' },
      select: { id: true, deliveryState: true },
    });
    if (!message) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockIncidentTransaction(tx, incidentId);

        const existingSeen = await tx.messageEvent.findFirst({
          where: {
            sosMessageId: message.id,
            deliveryState: DeliveryState.OPERATOR_SEEN,
            source: 'operator_view',
          },
          select: { id: true },
        });
        if (existingSeen) {
          return { created: false, messageEventId: existingSeen.id };
        }

        const incident = await tx.incident.findUnique({
          where: { id: incidentId },
          select: { reviewStatus: true },
        });
        if (!incident) {
          throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
        }

        const event = await tx.messageEvent.create({
          data: {
            sosMessageId: message.id,
            deliveryState: DeliveryState.OPERATOR_SEEN,
            source: 'operator_view',
            metadataJson: { actorId: user.sub },
          },
        });

        const nextDelivery = canTransitionDelivery(message.deliveryState, DeliveryState.OPERATOR_SEEN)
          ? DeliveryState.OPERATOR_SEEN
          : message.deliveryState;

        await tx.sosMessage.update({
          where: { id: message.id },
          data: { deliveryState: nextDelivery },
        });

        const nextReview =
          incident.reviewStatus === OperatorReviewStatus.NEW
            ? OperatorReviewStatus.SEEN
            : incident.reviewStatus;

        await tx.incident.update({
          where: { id: incidentId },
          data: {
            reviewStatus: nextReview,
            version: { increment: 1 },
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: user.sub,
            incidentId,
            action: 'OPERATOR_SEEN',
            detailsJson: {
              messageEventId: event.id,
              sosMessageId: message.id,
            },
          },
        });

        return { created: true, messageEventId: event.id };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.messageEvent.findFirst({
          where: {
            sosMessageId: message.id,
            deliveryState: DeliveryState.OPERATOR_SEEN,
            source: 'operator_view',
          },
          select: { id: true },
        });
        return { created: false, messageEventId: existing?.id ?? null };
      }
      throw error;
    }
  }

  async transitionReviewStatus(
    user: OperatorRequestUser,
    incidentId: string,
    target: OperatorReviewStatus,
    expectedVersion: number
  ) {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    return this.prisma.$transaction(async (tx) => {
      await lockIncidentTransaction(tx, incidentId);

      const incident = await tx.incident.findUnique({
        where: { id: incidentId },
        select: { version: true, reviewStatus: true },
      });
      if (!incident) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
      }
      if (incident.version !== expectedVersion) {
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: 'Case was updated by another operator',
          currentVersion: incident.version,
        });
      }
      if (!canTransitionReview(incident.reviewStatus, target)) {
        throw new BadRequestException({
          code: 'INVALID_REVIEW_TRANSITION',
          message: `Cannot transition review status from ${incident.reviewStatus} to ${target}`,
        });
      }

      const bumped = await tx.incident.updateMany({
        where: { id: incidentId, version: expectedVersion },
        data: {
          reviewStatus: target,
          version: { increment: 1 },
        },
      });
      if (bumped.count !== 1) {
        throw new ConflictException({
          code: 'VERSION_CONFLICT',
          message: 'Case was updated by another operator',
          currentVersion: incident.version,
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          incidentId,
          action: 'REVIEW_STATUS_CHANGED',
          detailsJson: {
            before: incident.reviewStatus,
            after: target,
            expectedVersion,
          },
        },
      });

      const message = await tx.sosMessage.findFirst({
        where: { incidentId },
        orderBy: { receivedAt: 'desc' },
        select: { id: true, deliveryState: true },
      });
      if (
        message &&
        target === OperatorReviewStatus.UNDER_REVIEW &&
        canTransitionDelivery(message.deliveryState, DeliveryState.CASE_IN_PROGRESS)
      ) {
        await tx.sosMessage.update({
          where: { id: message.id },
          data: { deliveryState: DeliveryState.CASE_IN_PROGRESS },
        });
        await tx.messageEvent.create({
          data: {
            sosMessageId: message.id,
            deliveryState: DeliveryState.CASE_IN_PROGRESS,
            source: 'operator_review',
            metadataJson: { actorId: user.sub },
          },
        });
      }

      const row = await tx.incident.findUnique({
        where: { id: incidentId },
        select: { version: true, reviewStatus: true },
      });
      if (!row) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
      }
      return row;
    });
  }

  async applyMetadataCorrection(
    user: OperatorRequestUser,
    incidentId: string,
    body: MetadataCorrectionInput & { expectedVersion: number }
  ) {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const message = await this.prisma.sosMessage.findFirst({
      where: { incidentId },
      orderBy: { receivedAt: 'desc' },
    });
    if (!message) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const current = {
      personCount: message.personCount,
      locationStatus: message.locationStatus,
      latitude: message.latitude ? message.latitude.toNumber() : null,
      longitude: message.longitude ? message.longitude.toNumber() : null,
    };
    const { data, before, after } = buildMetadataCorrectionUpdate(current, body);

    const version = await this.prisma.$transaction(async (tx) => {
      await lockIncidentTransaction(tx, incidentId);
      const nextVersion = await assertIncidentVersionAndIncrement(
        tx,
        incidentId,
        body.expectedVersion
      );
      await tx.sosMessage.update({ where: { id: message.id }, data });
      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          incidentId,
          action: 'METADATA_CORRECTION',
          detailsJson: { before, after, expectedVersion: body.expectedVersion },
        },
      });
      return nextVersion;
    });

    return { version, before, after };
  }

  async applyAiOverride(
    user: OperatorRequestUser,
    incidentId: string,
    body: { expectedVersion: number; override: Record<string, unknown> }
  ) {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const validated = validateSosAiOutput({
      ...body.override,
      requires_human_review: true,
    });
    if (validated.ok === false) {
      throw new BadRequestException({
        code: 'INVALID_AI_OVERRIDE',
        message: validated.reason,
      });
    }

    const latestAi = await this.prisma.aiAnalysis.findFirst({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });
    const before = latestAi?.resultJson ?? null;

    const version = await this.prisma.$transaction(async (tx) => {
      await lockIncidentTransaction(tx, incidentId);
      const nextVersion = await assertIncidentVersionAndIncrement(
        tx,
        incidentId,
        body.expectedVersion
      );

      if (latestAi) {
        await tx.aiAnalysis.update({
          where: { id: latestAi.id },
          data: {
            status: 'OPERATOR_OVERRIDE',
            resultJson: {
              ...validated.value,
              operator_override: true,
              operator_override_by: user.sub,
            },
          },
        });
      } else {
        await tx.aiAnalysis.create({
          data: {
            incidentId,
            modelVersion: 'operator-override',
            status: 'OPERATOR_OVERRIDE',
            resultJson: {
              ...validated.value,
              operator_override: true,
              operator_override_by: user.sub,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          incidentId,
          action: 'AI_OVERRIDE',
          detailsJson: { before, after: validated.value, expectedVersion: body.expectedVersion },
        },
      });

      return nextVersion;
    });

    return { version, suggestion: validated.value };
  }

  async listAudit(user: OperatorRequestUser, incidentId: string): Promise<OperatorCaseAuditEntry[]> {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }
    const rows = await this.prisma.auditLog.findMany({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        actorId: true,
        createdAt: true,
        detailsJson: true,
        actor: { select: { displayName: true } },
      },
    });
    return rows.map((row) => {
      const details = (row.detailsJson ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        action: row.action,
        actorId: row.actorId,
        actorDisplayName: row.actor?.displayName ?? null,
        createdAt: row.createdAt.toISOString(),
        before: details.before ?? null,
        after: details.after ?? details,
      };
    });
  }
}
