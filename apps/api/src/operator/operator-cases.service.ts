import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { buildPaginated, parsePagination } from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { OperatorRequestUser } from './guards/operator-auth.guard';
import { IncidentScopeService } from './incident-scope.service';
import { ListOperatorCasesQuery } from './dto/list-operator-cases.query';

export type OperatorCaseRow = {
  incidentId: string;
  incidentState: string;
  messageId: string;
  sosMessageId: string;
  priority: number;
  sosType: string;
  deliveryState: string;
  locationStatus: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  receivedAt: string;
  source: string | null;
};

export type OperatorAiSuggestion = {
  status: string;
  modelVersion: string;
  suggestion: Record<string, unknown> | null;
  verified: false;
  label: 'öneri/taslak, doğrulanmadı';
};

export type OperatorCaseDetail = OperatorCaseRow & {
  version: number;
  reviewStatus: string;
  originalText: string | null;
  verifiedMetadata: {
    personCount: number | null;
    locationStatus: string;
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
  };
  ai: OperatorAiSuggestion | null;
  timeline: {
    id: string;
    deliveryState: string;
    source: string;
    createdAt: string;
  }[];
};

@Injectable()
export class OperatorCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService
  ) {}

  async listCases(user: OperatorRequestUser, query: ListOperatorCasesQuery) {
    const pagination = parsePagination({
      cursor: query.cursor,
      limit: query.limit,
    });
    const scopeWhere = this.scope.incidentWhere(user);
    const incidentFilter: Prisma.IncidentWhereInput = scopeWhere ?? {};

    const messageWhere: Prisma.SosMessageWhereInput = {
      incident: {
        ...incidentFilter,
        ...(query.incidentState ? { state: query.incidentState } : {}),
      },
      ...(query.category ? { sosType: query.category } : {}),
      ...(query.deliveryState ? { deliveryState: query.deliveryState } : {}),
      ...(query.locationStatus ? { locationStatus: query.locationStatus } : {}),
      ...(query.receivedFrom || query.receivedTo
        ? {
            receivedAt: {
              ...(query.receivedFrom ? { gte: query.receivedFrom } : {}),
              ...(query.receivedTo ? { lte: query.receivedTo } : {}),
            },
          }
        : {}),
      ...(query.accuracyMin !== undefined || query.accuracyMax !== undefined
        ? {
            accuracyMeters: {
              ...(query.accuracyMin !== undefined ? { gte: query.accuracyMin } : {}),
              ...(query.accuracyMax !== undefined ? { lte: query.accuracyMax } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            messageId: { contains: query.search, mode: 'insensitive' },
          }
        : {}),
      ...(query.source
        ? {
            messageEvents: {
              some: { source: { equals: query.source, mode: 'insensitive' } },
            },
          }
        : {}),
    };

    const rows = await this.prisma.sosMessage.findMany({
      where: messageWhere,
      take: pagination.limit + 1,
      ...(pagination.cursor
        ? { skip: 1, cursor: { id: pagination.cursor } }
        : {}),
      orderBy: [{ priority: 'asc' }, { receivedAt: 'desc' }],
      select: {
        id: true,
        messageId: true,
        incidentId: true,
        priority: true,
        sosType: true,
        deliveryState: true,
        locationStatus: true,
        latitude: true,
        longitude: true,
        accuracyMeters: true,
        receivedAt: true,
        incident: { select: { state: true } },
        messageEvents: {
          select: { source: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const withCursor = rows.map((row) => ({ id: row.id, ...this.toRow(row) }));
    const page = buildPaginated(withCursor, pagination.limit);
    return {
      items: page.items.map(({ id: cursorId, ...rest }) => {
        void cursorId;
        return rest;
      }),
      nextCursor: page.nextCursor,
      limit: page.limit,
    };
  }

  async getCaseDetail(
    user: OperatorRequestUser,
    incidentId: string
  ): Promise<OperatorCaseDetail | null> {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      return null;
    }
    const message = await this.prisma.sosMessage.findFirst({
      where: { incidentId },
      orderBy: { receivedAt: 'desc' },
      select: {
        id: true,
        messageId: true,
        incidentId: true,
        priority: true,
        sosType: true,
        deliveryState: true,
        locationStatus: true,
        latitude: true,
        longitude: true,
        accuracyMeters: true,
        receivedAt: true,
        personCount: true,
        operatorDisplayText: true,
        incident: { select: { state: true, version: true, reviewStatus: true } },
        messageEvents: {
          select: {
            id: true,
            deliveryState: true,
            source: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });
    if (!message) {
      return null;
    }
    const base = this.toRow({
      ...message,
      messageEvents: message.messageEvents.length
        ? [{ source: message.messageEvents[message.messageEvents.length - 1].source }]
        : [],
    });

    const aiRow = await this.prisma.aiAnalysis.findFirst({
      where: { incidentId },
      orderBy: { createdAt: 'desc' },
    });

    const aiSuggestion: OperatorAiSuggestion | null = aiRow
      ? {
          status: aiRow.status,
          modelVersion: aiRow.modelVersion,
          suggestion:
            aiRow.status === 'COMPLETED' ||
            aiRow.status === 'OPERATOR_OVERRIDE' ||
            (aiRow.resultJson as Record<string, unknown>).categories
              ? (aiRow.resultJson as Record<string, unknown>)
              : null,
          verified: false,
          label: 'öneri/taslak, doğrulanmadı',
        }
      : null;

    return {
      ...base,
      version: message.incident.version,
      reviewStatus: message.incident.reviewStatus,
      originalText: message.operatorDisplayText,
      verifiedMetadata: {
        personCount: message.personCount,
        locationStatus: message.locationStatus,
        latitude: message.latitude ? message.latitude.toNumber() : null,
        longitude: message.longitude ? message.longitude.toNumber() : null,
        accuracyMeters: message.accuracyMeters,
      },
      ai: aiSuggestion,
      timeline: message.messageEvents.map((event) => ({
        id: event.id,
        deliveryState: event.deliveryState,
        source: event.source,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  private toRow(row: {
    id: string;
    messageId: string;
    incidentId: string;
    priority: number;
    sosType: string;
    deliveryState: string;
    locationStatus: string;
    latitude: { toNumber(): number } | null;
    longitude: { toNumber(): number } | null;
    accuracyMeters: number | null;
    receivedAt: Date;
    incident: { state: string };
    messageEvents: { source: string }[];
  }): OperatorCaseRow {
    return {
      incidentId: row.incidentId,
      incidentState: row.incident.state,
      messageId: row.messageId,
      sosMessageId: row.id,
      priority: row.priority,
      sosType: row.sosType,
      deliveryState: row.deliveryState,
      locationStatus: row.locationStatus,
      latitude: row.latitude ? row.latitude.toNumber() : null,
      longitude: row.longitude ? row.longitude.toNumber() : null,
      accuracyMeters: row.accuracyMeters,
      receivedAt: row.receivedAt.toISOString(),
      source: row.messageEvents[0]?.source ?? null,
    };
  }
}
