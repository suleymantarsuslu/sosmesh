import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { buildPaginated, parsePagination } from '../common/pagination/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { OperatorRequestUser } from './guards/operator-auth.guard';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { ListOperatorCasesQuery } from './dto/list-operator-cases.query';
import { TranscriptView } from '../ai/contracts/transcript-view';
import { buildCaseSenderView, type CaseSenderView } from '../mesh-v2/case-sender-view';
import { MessageTranslationService } from '../ai/message-translation.service';
import { OperatorLocale } from '../ai/locale-content.service';

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
  locationApproximate: boolean;
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

export type OperatorAttachmentSummary = {
  id: string;
  kind: 'audio' | 'photo';
  mime: string;
  sizeBytes: number;
  durationMs: number | null;
  createdAt: string;
  transcriptStatus: 'pending' | 'processing' | 'completed' | 'failed' | null;
  visionStatus: 'pending' | 'processing' | 'completed' | 'failed' | null;
};

export type OperatorCaseDetail = OperatorCaseRow & {
  version: number;
  reviewStatus: string;
  originalText: string | null;
  translatedText: string | null;
  detectedLanguage: string | null;
  verifiedMetadata: {
    personCount: number | null;
    locationStatus: string;
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
    locationApproximate: boolean;
  };
  ai: OperatorAiSuggestion | null;
  attachments: OperatorAttachmentSummary[];
  transcripts: TranscriptView[];
  /** Mesh v2 sender block (profile, address assumption, merged messages); null for v1 incidents. */
  sender: CaseSenderView | null;
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
    private readonly scope: IncidentScopeService,
    private readonly messageTranslation: MessageTranslationService
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
        deletedAt: null,
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
        preciseLatitude: true,
        preciseLongitude: true,
        preciseAccuracyMeters: true,
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
    incidentId: string,
    locale: OperatorLocale = 'tr'
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
        preciseLatitude: true,
        preciseLongitude: true,
        preciseAccuracyMeters: true,
        preciseCapturedAt: true,
        receivedAt: true,
        personCount: true,
        operatorDisplayText: true,
        noteText: true,
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
            aiRow.status.toUpperCase() === 'COMPLETED' ||
            aiRow.status.toUpperCase() === 'OPERATOR_OVERRIDE' ||
            (aiRow.resultJson as Record<string, unknown>).categories
              ? (aiRow.resultJson as Record<string, unknown>)
              : null,
          verified: false,
          label: 'öneri/taslak, doğrulanmadı',
        }
      : null;

    const attachments = await this.prisma.attachment.findMany({
      where: { incidentId },
      include: {
        transcript: true,
        visionAnalysis: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const attachmentSummaries: OperatorAttachmentSummary[] = attachments.map((att) => ({
      id: att.id,
      kind: att.kind === 'image' ? 'photo' : (att.kind as 'audio' | 'photo'),
      mime: att.mime,
      sizeBytes: att.sizeBytes,
      durationMs: att.durationMs,
      createdAt: att.createdAt.toISOString(),
      transcriptStatus: att.transcript ? 'completed' : null,
      visionStatus: att.visionAnalysis ? 'completed' : null,
    }));

    const transcripts: TranscriptView[] = await Promise.all(
      attachments
        .filter((a) => a.transcript)
        .map(async (a) => ({
          attachmentId: a.id,
          model: a.transcript!.model,
          transcript: a.transcript!.transcript,
          turns: a.transcript!.turns as TranscriptView['turns'],
          language: a.transcript!.language,
          audioDurationMs: a.transcript!.audioDurationMs,
          createdAt: a.transcript!.createdAt.toISOString(),
          ...(await this.messageTranslation.getTranscriptTranslationFields(
            a.transcript!.id,
            a.transcript!.transcript,
            a.transcript!.language,
            locale
          )),
        }))
    );

    const originalText = message.noteText ?? message.operatorDisplayText;
    let translatedText: string | null = null;
    let detectedLanguage: string | null = null;

    if (originalText) {
      const translation = await this.messageTranslation.translateMessage(
        message.id,
        originalText,
        locale
      );
      if (translation) {
        translatedText = translation.translatedText;
        detectedLanguage = translation.detectedLanguage;
      }
    }

    return {
      ...base,
      version: message.incident.version,
      reviewStatus: message.incident.reviewStatus,
      originalText,
      translatedText,
      detectedLanguage,
      verifiedMetadata: {
        personCount: message.personCount,
        locationStatus: message.locationStatus,
        latitude: message.preciseLatitude
          ? message.preciseLatitude.toNumber()
          : message.latitude
          ? message.latitude.toNumber()
          : null,
        longitude: message.preciseLongitude
          ? message.preciseLongitude.toNumber()
          : message.longitude
          ? message.longitude.toNumber()
          : null,
        accuracyMeters: message.preciseAccuracyMeters ?? message.accuracyMeters,
        locationApproximate: !message.preciseLatitude && !!message.latitude,
      },
      ai: aiSuggestion,
      attachments: attachmentSummaries,
      transcripts,
      sender: await buildCaseSenderView(this.prisma, incidentId),
      timeline: message.messageEvents.map((event) => ({
        id: event.id,
        deliveryState: event.deliveryState,
        source: event.source,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async listAttachments(user: OperatorRequestUser, incidentId: string) {
    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      return null;
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { incidentId },
      include: {
        transcript: true,
        visionAnalysis: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return attachments.map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind,
      mime: attachment.mime,
      sizeBytes: attachment.sizeBytes,
      durationMs: attachment.durationMs,
      createdAt: attachment.createdAt.toISOString(),
      transcript: attachment.transcript
        ? {
            id: attachment.transcript.id,
            model: attachment.transcript.model,
            transcript: attachment.transcript.transcript,
            turns: attachment.transcript.turns,
            language: attachment.transcript.language,
            audioDurationMs: attachment.transcript.audioDurationMs,
          }
        : null,
      visionAnalysis: attachment.visionAnalysis
        ? {
            id: attachment.visionAnalysis.id,
            status: 'completed' as const,
            sparkSummary: (attachment.visionAnalysis.sparkSummary as any)?.description || null,
            hasSamResults:
              Array.isArray(attachment.visionAnalysis.samResults) &&
              attachment.visionAnalysis.samResults.length > 0,
          }
        : null,
    }));
  }

  async listHistory(user: OperatorRequestUser) {
    const scopeWhere = this.scope.incidentWhere(user);
    const incidentFilter: Prisma.IncidentWhereInput = scopeWhere ?? {};

    const incidents = await this.prisma.incident.findMany({
      where: {
        ...incidentFilter,
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        state: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        sosMessages: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            messageId: true,
            priority: true,
            sosType: true,
            receivedAt: true,
          },
        },
      },
    });

    return {
      items: incidents.map((incident) => {
        const message = incident.sosMessages[0];
        return {
          incidentId: incident.id,
          incidentState: incident.state,
          deletedAt: incident.deletedAt?.toISOString() ?? null,
          createdAt: incident.createdAt.toISOString(),
          messageId: message?.messageId ?? null,
          sosMessageId: message?.id ?? null,
          priority: message?.priority ?? 0,
          sosType: message?.sosType ?? null,
          receivedAt: message?.receivedAt?.toISOString() ?? null,
        };
      }),
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
    preciseLatitude: { toNumber(): number } | null;
    preciseLongitude: { toNumber(): number } | null;
    preciseAccuracyMeters: number | null;
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
      latitude: row.preciseLatitude
        ? row.preciseLatitude.toNumber()
        : row.latitude
        ? row.latitude.toNumber()
        : null,
      longitude: row.preciseLongitude
        ? row.preciseLongitude.toNumber()
        : row.longitude
        ? row.longitude.toNumber()
        : null,
      accuracyMeters: row.preciseAccuracyMeters ?? row.accuracyMeters,
      locationApproximate: !row.preciseLatitude && !!row.latitude,
      receivedAt: row.receivedAt.toISOString(),
      source: row.messageEvents[0]?.source ?? null,
    };
  }
}
