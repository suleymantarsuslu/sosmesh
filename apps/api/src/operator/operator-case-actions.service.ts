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
      select: { id: true, deliveryState: true, incidentId: true },
    });
    if (!message) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const existingSeen = await this.prisma.messageEvent.findFirst({
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

    const result = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({
        where: { id: incidentId },
        select: { version: true, reviewStatus: true },
      });
      if (!incident) {
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
      }

      const event = await tx.messageEvent.create({
        data: {
          sosMessageId: message.id,
          deliveryState: DeliveryState.OPERATOR_SEEN,
          source: 'operator_view',
          metadataJson: {
            actorId: user.sub,
          },
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

      return event.id;
    });

    return { created: true, messageEventId: result };
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

    const incident = await this.prisma.incident.findUnique({
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.incident.update({
        where: { id: incidentId, version: expectedVersion },
        data: {
          reviewStatus: target,
          version: { increment: 1 },
        },
        select: { version: true, reviewStatus: true },
      });

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

      return row;
    });

    return updated;
  }

  async applyMetadataCorrection(
    user: OperatorRequestUser,
    incidentId: string,
    body: {
      expectedVersion: number;
      personCount?: number | null;
      locationStatus?: 'UNKNOWN' | 'GPS' | 'MANUAL';
      latitude?: number | null;
      longitude?: number | null;
    }
  ) {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { version: true },
    });
    if (!incident) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }
    if (incident.version !== body.expectedVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'Case was updated by another operator',
        currentVersion: incident.version,
      });
    }

    const message = await this.prisma.sosMessage.findFirst({
      where: { incidentId },
      orderBy: { receivedAt: 'desc' },
    });
    if (!message) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const before = {
      personCount: message.personCount,
      locationStatus: message.locationStatus,
      latitude: message.latitude ? message.latitude.toNumber() : null,
      longitude: message.longitude ? message.longitude.toNumber() : null,
    };

    const data: Prisma.SosMessageUpdateInput = {};
    if (body.personCount !== undefined) {
      data.personCount = body.personCount;
    }
    if (body.locationStatus !== undefined) {
      data.locationStatus = body.locationStatus;
    }
    if (body.latitude !== undefined) {
      data.latitude = body.latitude;
    }
    if (body.longitude !== undefined) {
      data.longitude = body.longitude;
    }

    const after = {
      personCount: body.personCount !== undefined ? body.personCount : before.personCount,
      locationStatus:
        body.locationStatus !== undefined ? body.locationStatus : before.locationStatus,
      latitude: body.latitude !== undefined ? body.latitude : before.latitude,
      longitude: body.longitude !== undefined ? body.longitude : before.longitude,
    };

    const version = await this.prisma.$transaction(async (tx) => {
      await tx.sosMessage.update({ where: { id: message.id }, data });
      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          incidentId,
          action: 'METADATA_CORRECTION',
          detailsJson: { before, after, expectedVersion: body.expectedVersion },
        },
      });
      const row = await tx.incident.update({
        where: { id: incidentId, version: body.expectedVersion },
        data: { version: { increment: 1 } },
        select: { version: true },
      });
      return row.version;
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

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { version: true },
    });
    if (!incident) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }
    if (incident.version !== body.expectedVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'Case was updated by another operator',
        currentVersion: incident.version,
      });
    }

    const latestAi = await this.prisma.aiAnalysis.findFirst({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });

    const before = latestAi?.resultJson ?? null;

    const version = await this.prisma.$transaction(async (tx) => {
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

      const row = await tx.incident.update({
        where: { id: incidentId, version: body.expectedVersion },
        data: { version: { increment: 1 } },
        select: { version: true },
      });
      return row.version;
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
