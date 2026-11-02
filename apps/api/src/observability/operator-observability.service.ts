import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { redactAuditDetails } from '../privacy/audit-redaction.util';
import { SosMeshMetricsService } from './sosmesh-metrics.service';

export type ObservabilitySummary = {
  statusPage: {
    overall: 'operational' | 'degraded' | 'major_outage';
    components: {
      api: 'operational' | 'degraded' | 'major_outage';
      database: 'operational' | 'major_outage';
      aiWorker: 'operational' | 'degraded' | 'major_outage';
    };
    updatedAt: string;
  };
  metrics: {
    ingestAccepted: number;
    ingestDedup: number;
    radioAck: number;
    serverAck: number;
    aiFailures: number;
    aiQueueDepth: number;
    httpErrors: number;
    databaseUp: number;
  };
};

@Injectable()
export class OperatorObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: SosMeshMetricsService
  ) {}

  getSummary(): ObservabilitySummary {
    const databaseUp = this.metrics.getGauge('sosmesh_health_database_up');
    const aiQueueDepth = this.metrics.getGauge('sosmesh_ai_job_queue_depth');
    const aiFailures = this.metrics.getCounter('sosmesh_ai_failures_total');
    const httpErrors = this.metrics.getCounter('sosmesh_http_errors_total');

    const dbComponent = databaseUp === 1 ? 'operational' : 'major_outage';
    const aiComponent =
      aiQueueDepth >= 50 || aiFailures >= 5
        ? 'degraded'
        : 'operational';
    const apiComponent = httpErrors >= 3 ? 'degraded' : 'operational';

    let overall: ObservabilitySummary['statusPage']['overall'] = 'operational';
    if (dbComponent === 'major_outage') {
      overall = 'major_outage';
    } else if (apiComponent === 'degraded' || aiComponent === 'degraded') {
      overall = 'degraded';
    }

    return {
      statusPage: {
        overall,
        components: {
          api: apiComponent,
          database: dbComponent,
          aiWorker: aiComponent,
        },
        updatedAt: new Date().toISOString(),
      },
      metrics: {
        ingestAccepted: this.metrics.getCounter('sosmesh_ingest_accepted_total'),
        ingestDedup: this.metrics.getCounter('sosmesh_ingest_dedup_total'),
        radioAck: this.metrics.getCounter('sosmesh_radio_ack_total'),
        serverAck: this.metrics.getCounter('sosmesh_server_ack_total'),
        aiFailures,
        aiQueueDepth,
        httpErrors,
        databaseUp,
      },
    };
  }

  async listRecentAudit(limit = 50) {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        actorId: true,
        incidentId: true,
        createdAt: true,
        detailsJson: true,
        actor: { select: { role: true } },
      },
    });
    return rows.map((row) => {
      const details = redactAuditDetails((row.detailsJson ?? {}) as Record<string, unknown>);
      return {
        id: row.id,
        action: row.action,
        actorId: row.actorId,
        actorRole: row.actor?.role ?? UserRole.OPERATOR,
        incidentId: row.incidentId,
        createdAt: row.createdAt.toISOString(),
        details,
      };
    });
  }
}
