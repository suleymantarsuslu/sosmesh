import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import {
  AI_ANALYSIS_STATUS,
  DEFAULT_ESTIMATED_TOKENS_PER_CLASSIFY,
  DEFAULT_INCIDENT_TOKEN_BUDGET,
  DEFAULT_META_MODEL,
} from './ai.constants';
import { getAiRunMetrics } from './ai-metrics';
import { runWithCorrelation } from '../observability/correlation-context.util';
import { SosMeshMetricsService } from '../observability/sosmesh-metrics.service';
import { StructuredEventLogger } from '../observability/structured-event-logger.service';
import { withWorkerSpan } from '../observability/otel-tracing';
import { AiCostGuard, IncidentTokenBudgetGuard, TenantAiRateLimiter } from './ai-guards';
import { deidentifySosPlaintextForPrompt } from './deidentify-plaintext';
import {
  buildMetaProviderFromEnv,
  buildMockMetaProvider,
  type MetaProvider,
} from './providers/meta';
import { EVAL_FIXTURES } from './evals/fixtures';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildSafeFallbackSosAiOutput,
  isSchemaOrParseFailure,
} from './schemas/safe-fallback';
import {
  NullSosPlaintextSource,
  SOS_PLAINTEXT_SOURCE,
  type SosPlaintextSource,
} from './sos-plaintext-source';

export const AI_PROVIDER_OVERRIDE = 'AI_PROVIDER_OVERRIDE';

function detectLanguageHint(plaintext: string): string {
  const lower = plaintext.toLowerCase();
  const turkishMarkers = ['deprem', 'yangın', 'yardım', 'enkaz', 'lütfen', 'bilmiyoruz'];
  if (turkishMarkers.some((marker) => lower.includes(marker))) {
    return 'tr';
  }
  return 'en';
}

@Injectable()
export class AiJobService {
  private readonly logger = new Logger(AiJobService.name);
  private readonly tenantLimiter: TenantAiRateLimiter;
  private readonly costGuard: AiCostGuard;
  private readonly incidentTokenBudget: IncidentTokenBudgetGuard;
  private readonly providerOverride: MetaProvider | null;
  private readonly plaintextSource: SosPlaintextSource;
  private pendingJobs = 0;
  private lastQueueProgressMs = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: SosMeshMetricsService,
    private readonly events: StructuredEventLogger,
    @Optional() @Inject(AI_PROVIDER_OVERRIDE) providerOverride: MetaProvider | null = null,
    @Optional() @Inject(SOS_PLAINTEXT_SOURCE) plaintextSource: SosPlaintextSource | null = null
  ) {
    this.tenantLimiter = new TenantAiRateLimiter(
      Number(process.env.AI_TENANT_RATE_LIMIT_MAX ?? 30),
      Number(process.env.AI_TENANT_RATE_LIMIT_WINDOW_MS ?? 60000)
    );
    this.costGuard = new AiCostGuard(() => Number(process.env.AI_DAILY_COST_CAP_USD ?? 5));
    this.incidentTokenBudget = new IncidentTokenBudgetGuard(
      Number(process.env.AI_INCIDENT_TOKEN_BUDGET ?? DEFAULT_INCIDENT_TOKEN_BUDGET)
    );
    this.providerOverride = providerOverride ?? null;
    this.plaintextSource = plaintextSource ?? new NullSosPlaintextSource();
  }

  enqueueAfterIngest(params: {
    incidentId: string;
    messageId: string;
    tenantKey: string;
  }): void {
    this.pendingJobs += 1;
    this.metrics.setAiQueueDepth(this.pendingJobs);
    this.metrics.setWorkerStuckSeconds(this.getWorkerStuckSecondsForAlerts());
    setImmediate(() => {
      void this.runJob(params)
        .catch((error) => {
          this.metrics.recordAiFailure();
          this.logger.error(
            { incidentId: params.incidentId, err: error instanceof Error ? error.message : 'job_failed' },
            'AI job failed'
          );
        })
        .finally(() => {
          this.pendingJobs = Math.max(0, this.pendingJobs - 1);
          this.lastQueueProgressMs = Date.now();
          this.metrics.setAiQueueDepth(this.pendingJobs);
          this.metrics.setWorkerStuckSeconds(this.getWorkerStuckSecondsForAlerts());
        });
    });
  }

  getWorkerStuckSecondsForAlerts(): number {
    if (this.pendingJobs <= 0) {
      return 0;
    }
    return Math.floor((Date.now() - this.lastQueueProgressMs) / 1000);
  }

  async runJob(params: {
    incidentId: string;
    messageId: string;
    tenantKey: string;
  }): Promise<void> {
    return runWithCorrelation(params.messageId, () =>
      withWorkerSpan('ai.classify', params.messageId, async () => {
        await this.runJobInner(params);
      })
    );
  }

  private async runJobInner(params: {
    incidentId: string;
    messageId: string;
    tenantKey: string;
  }): Promise<void> {
    const metrics = getAiRunMetrics();
    const aiEnabled = process.env.AI_ENABLED !== 'false';
    if (!aiEnabled) {
      metrics.recordSkip('skippedDisabled');
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.SKIPPED_DISABLED);
      return;
    }

    const plaintext = await this.plaintextSource.getPlaintext({
      incidentId: params.incidentId,
      messageId: params.messageId,
    });
    if (!plaintext) {
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.NO_PLAINTEXT);
      return;
    }

    if (!this.tenantLimiter.tryConsume(params.tenantKey)) {
      metrics.recordSkip('skippedRateLimit');
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.SKIPPED_RATE_LIMIT);
      return;
    }

    const estimatedCost = Number(process.env.AI_ESTIMATED_COST_USD ?? 0.002);
    if (!this.costGuard.tryCharge(estimatedCost)) {
      metrics.recordSkip('skippedCostCap');
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.SKIPPED_COST_CAP);
      return;
    }
    metrics.recordCostUsd(estimatedCost);

    const estimatedTokens = Number(
      process.env.AI_ESTIMATED_TOKENS_PER_CLASSIFY ?? DEFAULT_ESTIMATED_TOKENS_PER_CLASSIFY
    );
    if (!this.incidentTokenBudget.tryConsume(params.incidentId, estimatedTokens)) {
      metrics.recordSkip('skippedIncidentTokenBudget');
      await this.persistSkipped(
        params.incidentId,
        AI_ANALYSIS_STATUS.SKIPPED_INCIDENT_TOKEN_BUDGET
      );
      return;
    }
    metrics.recordIncidentTokens(estimatedTokens);

    const provider =
      this.providerOverride ??
      buildMetaProviderFromEnv(process.env) ??
      (process.env.NODE_ENV === 'test'
        ? buildMockMetaProvider(EVAL_FIXTURES)
        : null);

    if (!provider) {
      metrics.recordSkip('skippedNoKey');
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.SKIPPED_NO_KEY);
      return;
    }

    metrics.recordAttempt();

    const pending = await this.prisma.aiAnalysis.create({
      data: {
        incidentId: params.incidentId,
        modelVersion: DEFAULT_META_MODEL,
        status: AI_ANALYSIS_STATUS.PENDING,
        resultJson: { requires_human_review: true },
      },
    });

    const redactedPlaintext = deidentifySosPlaintextForPrompt(plaintext);
    const result = await provider.classify({ plaintext: redactedPlaintext });

    if (result.ok === false) {
      if (result.retryable === false && isSchemaOrParseFailure(result.reason)) {
        const fallback = buildSafeFallbackSosAiOutput({
          language: detectLanguageHint(plaintext),
          reason: result.reason,
        });
        metrics.recordFallback();
        await this.prisma.aiAnalysis.update({
          where: { id: pending.id },
          data: {
            status: AI_ANALYSIS_STATUS.COMPLETED_FALLBACK,
            modelVersion: 'safe-fallback',
            resultJson: {
              ...fallback,
              fallback_applied: true,
              fallback_reason: result.reason,
            },
          },
        });
        return;
      }

      metrics.recordFailed();
      this.metrics.recordAiFailure();
      await this.prisma.aiAnalysis.update({
        where: { id: pending.id },
        data: {
          status: AI_ANALYSIS_STATUS.FAILED,
          resultJson: {
            requires_human_review: true,
            error: result.reason,
          },
        },
      });
      return;
    }

    metrics.recordCompleted();
    await this.prisma.aiAnalysis.update({
      where: { id: pending.id },
      data: {
        status: AI_ANALYSIS_STATUS.COMPLETED,
        modelVersion: result.modelVersion,
        resultJson: result.output,
      },
    });
  }

  private async persistSkipped(incidentId: string, status: string): Promise<void> {
    await this.prisma.aiAnalysis.create({
      data: {
        incidentId,
        modelVersion: DEFAULT_META_MODEL,
        status,
        resultJson: { requires_human_review: true },
      },
    });
  }
}
