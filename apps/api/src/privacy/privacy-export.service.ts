import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { IncidentScopeService } from '../organization/incident-scope.service';
import { OperatorRequestUser } from '../operator/guards/operator-auth.guard';
import { auditDetailsForWrite } from './audit-redaction.util';

export type PrivacyExportBundle = {
  exportedAt: string;
  incident: {
    id: string;
    state: string;
    reviewStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: {
    messageId: string;
    deliveryState: string;
    locationStatus: string;
    priority: number;
    receivedAt: string;
    hasEncryptedPayload: boolean;
  }[];
  auditTrail: {
    id: string;
    action: string;
    actorId: string | null;
    createdAt: string;
    details: unknown;
  }[];
};

@Injectable()
export class PrivacyExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: IncidentScopeService
  ) {}

  async exportIncident(user: OperatorRequestUser, incidentId: string): Promise<PrivacyExportBundle> {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.COORDINATOR) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Export requires coordinator or admin role',
      });
    }

    const allowed = await this.scope.canAccessIncident(user, incidentId, this.prisma);
    if (!allowed) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        sosMessages: {
          orderBy: { receivedAt: 'desc' },
          select: {
            messageId: true,
            deliveryState: true,
            locationStatus: true,
            priority: true,
            receivedAt: true,
            encryptedNoteBlob: true,
            encryptedPayloadRef: true,
            operatorDisplayText: true,
            latitude: true,
            longitude: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            action: true,
            actorId: true,
            createdAt: true,
            detailsJson: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Case not found' });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: user.sub,
        incidentId,
        action: 'PRIVACY_EXPORT',
        detailsJson: auditDetailsForWrite({
          messageCount: incident.sosMessages.length,
          auditRows: incident.auditLogs.length,
        }),
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      incident: {
        id: incident.id,
        state: incident.state,
        reviewStatus: incident.reviewStatus,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
      },
      messages: incident.sosMessages.map((row) => ({
        messageId: row.messageId,
        deliveryState: row.deliveryState,
        locationStatus: row.locationStatus,
        priority: row.priority,
        receivedAt: row.receivedAt.toISOString(),
        hasEncryptedPayload: Boolean(row.encryptedNoteBlob || row.encryptedPayloadRef),
      })),
      auditTrail: incident.auditLogs.map((row) => ({
        id: row.id,
        action: row.action,
        actorId: row.actorId,
        createdAt: row.createdAt.toISOString(),
        details: auditDetailsForWrite((row.detailsJson ?? {}) as Record<string, unknown>),
      })),
    };
  }
}
