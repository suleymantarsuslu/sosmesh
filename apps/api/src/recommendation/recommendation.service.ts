import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentRecommendationStatus,
  LocationStatus,
  RecommendationFeedbackRating,
  UserRole,
  WorkTaskSource,
  WorkTaskStatus,
} from '@prisma/client';

import { recordRecommendationFeedbackForScoring } from '../ai/ai-metrics';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { WorkTaskService } from '../coordination/work-task.service';
import {
  rankResourceMatches,
  type RankedResourceMatch,
  type ResourceMatchCandidate,
} from './matching-engine';
import { RecommendationRationaleService } from './recommendation-rationale.service';
import { resolveZoneAnchor } from './demo-zone-anchors';

export type RecommendationDto = {
  id: string;
  incidentId: string;
  teamId: string;
  teamName: string;
  resourceId: string | null;
  resourceName: string | null;
  rank: number;
  distanceKm: number | null;
  available: boolean;
  status: AssignmentRecommendationStatus;
  deterministicNote: string;
  aiRationale: string | null;
  missingInfo: string[];
  dataFreshness: RankedResourceMatch['diagnostics']['dataFreshness'];
  previewAnchor: { latitude: number; longitude: number; synthetic: boolean };
  workTaskId: string | null;
  disclaimer: string;
};

function mapRecommendation(row: {
  id: string;
  incidentId: string;
  teamId: string;
  resourceId: string | null;
  rank: number;
  distanceKm: number | null;
  available: boolean;
  status: AssignmentRecommendationStatus;
  deterministicNote: string;
  aiRationale: string | null;
  missingInfoJson: unknown;
  dataFreshnessJson: unknown;
  workTaskId: string | null;
  team: { name: string; zoneCode: string | null };
  resource: { name: string; zoneCode: string | null } | null;
}): RecommendationDto {
  const missingInfo = Array.isArray(row.missingInfoJson)
    ? (row.missingInfoJson as string[])
    : [];
  const dataFreshness = row.dataFreshnessJson as RecommendationDto['dataFreshness'];
  const zone = row.resource?.zoneCode ?? row.team.zoneCode;
  const previewAnchor = resolveZoneAnchor(zone);
  return {
    id: row.id,
    incidentId: row.incidentId,
    teamId: row.teamId,
    teamName: row.team.name,
    resourceId: row.resourceId,
    resourceName: row.resource?.name ?? null,
    rank: row.rank,
    distanceKm: row.distanceKm,
    available: row.available,
    status: row.status,
    deterministicNote: row.deterministicNote,
    aiRationale: row.aiRationale,
    missingInfo,
    dataFreshness,
    previewAnchor,
    workTaskId: row.workTaskId,
    disclaimer:
      'Bu bir öneridir; nihai karar koordinatördedir. Otomatik fiziksel sevk yapılmaz.',
  };
}

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService,
    private readonly tasks: WorkTaskService,
    private readonly rationale: RecommendationRationaleService
  ) {}

  private assertCoordinator(user: OperatorRequestUser): void {
    if (user.role !== UserRole.COORDINATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only coordinators can confirm assignment recommendations',
      });
    }
  }

  async planRecommendations(
    user: OperatorRequestUser,
    incidentId: string,
    options: { includeAiRationale: boolean }
  ): Promise<{ items: RecommendationDto[]; regenerated: boolean }> {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        sosMessages: { orderBy: { receivedAt: 'desc' }, take: 1 },
      },
    });
    if (!incident) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }
    const message = incident.sosMessages[0];
    const now = new Date();
    const ctx = {
      latitude: message?.latitude ? Number(message.latitude) : null,
      longitude: message?.longitude ? Number(message.longitude) : null,
      accuracyMeters: message?.accuracyMeters ?? null,
      locationStatus: message?.locationStatus ?? LocationStatus.UNKNOWN,
      receivedAt: message?.receivedAt ?? incident.createdAt,
      incidentUpdatedAt: incident.updatedAt,
      now,
    };

    const resourceScope = this.scope.resourceWhere(user);
    const resources = await this.prisma.resource.findMany({
      where: { ...resourceScope, isActive: true },
      include: { team: { select: { id: true, name: true, zoneCode: true } } },
      take: 50,
    });

    const openCounts = await this.prisma.workTask.groupBy({
      by: ['teamId'],
      where: {
        status: { in: [WorkTaskStatus.PROPOSED, WorkTaskStatus.ASSIGNED, WorkTaskStatus.ACCEPTED] },
      },
      _count: { _all: true },
    });
    const openByTeam = new Map(openCounts.map((row) => [row.teamId, row._count._all]));

    const candidates: ResourceMatchCandidate[] = resources
      .filter((row) => row.teamId && row.team)
      .map((row) => {
        const availableFrom = row.availableFrom;
        const availableUntil = row.availableUntil;
        const isAvailableWindow =
          (!availableFrom || availableFrom <= now) &&
          (!availableUntil || availableUntil >= now);
        return {
          resourceId: row.id,
          resourceName: row.name,
          teamId: row.teamId as string,
          teamName: row.team!.name,
          zoneCode: row.zoneCode ?? row.team!.zoneCode,
          capacity: row.capacity,
          openTaskCount: openByTeam.get(row.teamId as string) ?? 0,
          isActive: row.isActive,
          isAvailableWindow,
        };
      });

    const ranked = rankResourceMatches({ incident: ctx, candidates }).slice(0, 5);
    const tenantKey = user.organizationId ?? user.teamId ?? user.sub;

    await this.prisma.$transaction(async (tx) => {
      await tx.assignmentRecommendation.updateMany({
        where: { incidentId, status: AssignmentRecommendationStatus.PROPOSED },
        data: { status: AssignmentRecommendationStatus.REJECTED },
      });

      for (const match of ranked) {
        let aiRationale: string | null = null;
        if (options.includeAiRationale) {
          const ai = await this.rationale.maybeBuildAiRationale({
            incidentId,
            tenantKey,
            operatorDisplayText: message?.operatorDisplayText ?? null,
            deterministicNote: match.deterministicNote,
            optIn: true,
          });
          aiRationale = ai.text;
        }

        await tx.assignmentRecommendation.create({
          data: {
            incidentId,
            teamId: match.teamId,
            resourceId: match.resourceId,
            rank: match.rank,
            distanceKm: match.distanceKm,
            available: match.available,
            status: AssignmentRecommendationStatus.PROPOSED,
            deterministicNote: match.deterministicNote,
            aiRationale,
            missingInfoJson: match.diagnostics.missingInfo,
            dataFreshnessJson: match.diagnostics.dataFreshness,
          },
        });
      }
    });

    const items = await this.listRecommendations(user, incidentId);
    return { items: items.items, regenerated: true };
  }

  async listRecommendations(
    user: OperatorRequestUser,
    incidentId: string
  ): Promise<{ items: RecommendationDto[] }> {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }
    const rows = await this.prisma.assignmentRecommendation.findMany({
      where: { incidentId },
      orderBy: [{ status: 'asc' }, { rank: 'asc' }],
      include: {
        team: { select: { name: true, zoneCode: true } },
        resource: { select: { name: true, zoneCode: true } },
      },
    });
    return { items: rows.map(mapRecommendation) };
  }

  async rejectRecommendation(
    user: OperatorRequestUser,
    recommendationId: string
  ): Promise<RecommendationDto> {
    const row = await this.prisma.assignmentRecommendation.findUnique({
      where: { id: recommendationId },
      include: {
        team: { select: { name: true, zoneCode: true } },
        resource: { select: { name: true, zoneCode: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recommendation not found' });
    }
    const allowed = await this.scope.canAccessIncident(user, row.incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recommendation not found' });
    }
    if (row.status !== AssignmentRecommendationStatus.PROPOSED) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: 'Only proposed recommendations can be rejected',
      });
    }

    const updated = await this.prisma.assignmentRecommendation.update({
      where: { id: recommendationId },
      data: { status: AssignmentRecommendationStatus.REJECTED },
      include: {
        team: { select: { name: true, zoneCode: true } },
        resource: { select: { name: true, zoneCode: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        incidentId: row.incidentId,
        action: 'recommendation.reject',
        detailsJson: { recommendationId, teamId: row.teamId },
      },
    });

    return mapRecommendation(updated);
  }

  async confirmRecommendation(
    user: OperatorRequestUser,
    recommendationId: string,
    body: { assigneeId: string }
  ): Promise<{ recommendation: RecommendationDto; taskId: string }> {
    this.assertCoordinator(user);
    if (!body.assigneeId) {
      throw new BadRequestException({
        code: 'ASSIGNEE_REQUIRED',
        message: 'Coordinator must select an assignee before commit',
      });
    }

    const row = await this.prisma.assignmentRecommendation.findUnique({
      where: { id: recommendationId },
      include: {
        team: { select: { name: true, zoneCode: true } },
        resource: { select: { name: true, zoneCode: true } },
      },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recommendation not found' });
    }
    const allowed = await this.scope.canAccessIncident(user, row.incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recommendation not found' });
    }
    if (row.status !== AssignmentRecommendationStatus.PROPOSED) {
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: 'Recommendation already finalized',
      });
    }
    if (!row.available) {
      throw new BadRequestException({
        code: 'RESOURCE_UNAVAILABLE',
        message: 'Cannot commit unavailable resource recommendation',
      });
    }

    const draft = await this.tasks.createAiDraft(user, {
      incidentId: row.incidentId,
      teamId: row.teamId,
      resourceId: row.resourceId ?? undefined,
      title: `Koordinatör onaylı görev: ${row.team.name}`,
      description: row.deterministicNote,
    });

    const assigned = await this.tasks.assignTask(user, draft.id, {
      assigneeId: body.assigneeId,
      expectedVersion: draft.version,
    });

    const finalized = await this.prisma.assignmentRecommendation.updateMany({
      where: {
        id: recommendationId,
        status: AssignmentRecommendationStatus.PROPOSED,
      },
      data: {
        status: AssignmentRecommendationStatus.CONFIRMED,
        workTaskId: assigned.id,
      },
    });

    if (finalized.count !== 1) {
      await this.tasks.withdrawTask(user, assigned.id, { expectedVersion: assigned.version });
      throw new BadRequestException({
        code: 'INVALID_STATE',
        message: 'Recommendation already finalized',
      });
    }

    const updated = await this.prisma.assignmentRecommendation.findUniqueOrThrow({
      where: { id: recommendationId },
      include: {
        team: { select: { name: true, zoneCode: true } },
        resource: { select: { name: true, zoneCode: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        incidentId: row.incidentId,
        action: 'recommendation.confirm',
        detailsJson: {
          recommendationId,
          workTaskId: assigned.id,
          source: WorkTaskSource.AI,
        },
      },
    });

    return {
      recommendation: mapRecommendation(updated),
      taskId: assigned.id,
    };
  }

  async recordFeedback(
    user: OperatorRequestUser,
    recommendationId: string,
    body: { rating: RecommendationFeedbackRating; note?: string }
  ): Promise<{ capturedForScoring: boolean }> {
    const row = await this.prisma.assignmentRecommendation.findUnique({
      where: { id: recommendationId },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recommendation not found' });
    }
    const allowed = await this.scope.canAccessIncident(user, row.incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Recommendation not found' });
    }

    await this.prisma.recommendationFeedback.create({
      data: {
        recommendationId,
        actorId: user.sub,
        rating: body.rating,
        note: body.note,
        capturedForScoring: true,
      },
    });

    recordRecommendationFeedbackForScoring(body.rating);

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        incidentId: row.incidentId,
        action: 'recommendation.feedback',
        detailsJson: {
          recommendationId,
          rating: body.rating,
          liveTraining: false,
        },
      },
    });

    return { capturedForScoring: true };
  }
}
