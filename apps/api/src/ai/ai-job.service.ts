import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import {
  AI_ANALYSIS_STATUS,
  DEFAULT_META_MODEL,
} from './ai.constants';
import { AiCostGuard, TenantAiRateLimiter } from './ai-guards';
import {
  buildMetaProviderFromEnv,
  buildMockMetaProvider,
  type MetaProvider,
} from './providers/meta';
import { EVAL_FIXTURES } from './evals/fixtures';
import { PrismaService } from '../prisma/prisma.service';

export const AI_PROVIDER_OVERRIDE = 'AI_PROVIDER_OVERRIDE';

/**
 * Plaintext source for AI (ADIM 20):
 * - Production ingest stores only encryptedPayload (opaque); server does not decrypt in M0.
 * - Optional dev/test field `sosMessage.plaintextForOperator` may be present on the envelope
 *   for controlled fixtures; it is never logged.
 * - When no plaintext is available, analysis is skipped with status NO_PLAINTEXT.
 */
export function resolvePlaintextForAi(sosMessageJson: Record<string, unknown>): string | null {
  const envelope = sosMessageJson.envelope;
  if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
    const note = (envelope as Record<string, unknown>).plaintextForOperator;
    if (typeof note === 'string' && note.trim().length > 0) {
      return note.trim();
    }
  }
  const topLevel = sosMessageJson.plaintextForOperator;
  if (typeof topLevel === 'string' && topLevel.trim().length > 0) {
    return topLevel.trim();
  }
  return null;
}

@Injectable()
export class AiJobService {
  private readonly logger = new Logger(AiJobService.name);
  private readonly tenantLimiter: TenantAiRateLimiter;
  private readonly costGuard: AiCostGuard;
  private readonly providerOverride: MetaProvider | null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(AI_PROVIDER_OVERRIDE) providerOverride: MetaProvider | null = null
  ) {
    this.tenantLimiter = new TenantAiRateLimiter(
      Number(process.env.AI_TENANT_RATE_LIMIT_MAX ?? 30),
      Number(process.env.AI_TENANT_RATE_LIMIT_WINDOW_MS ?? 60000)
    );
    this.costGuard = new AiCostGuard(Number(process.env.AI_DAILY_COST_CAP_USD ?? 25));
    this.providerOverride = providerOverride ?? null;
  }

  enqueueAfterIngest(params: {
    incidentId: string;
    tenantKey: string;
    sosMessageSnapshot: Record<string, unknown>;
  }): void {
    setImmediate(() => {
      void this.runJob(params).catch((error) => {
        this.logger.error(
          { incidentId: params.incidentId, err: error instanceof Error ? error.message : 'job_failed' },
          'AI job failed'
        );
      });
    });
  }

  async runJob(params: {
    incidentId: string;
    tenantKey: string;
    sosMessageSnapshot: Record<string, unknown>;
  }): Promise<void> {
    const aiEnabled = process.env.AI_ENABLED !== 'false';
    if (!aiEnabled) {
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.SKIPPED_DISABLED);
      return;
    }

    const plaintext = resolvePlaintextForAi(params.sosMessageSnapshot);
    if (!plaintext) {
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.NO_PLAINTEXT);
      return;
    }

    if (!this.tenantLimiter.tryConsume(params.tenantKey)) {
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.SKIPPED_RATE_LIMIT);
      return;
    }

    const estimatedCost = Number(process.env.AI_ESTIMATED_COST_USD ?? 0.002);
    if (!this.costGuard.tryCharge(estimatedCost)) {
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.SKIPPED_COST_CAP);
      return;
    }

    const provider =
      this.providerOverride ??
      buildMetaProviderFromEnv(process.env) ??
      (process.env.NODE_ENV === 'test'
        ? buildMockMetaProvider(EVAL_FIXTURES)
        : null);

    if (!provider) {
      await this.persistSkipped(params.incidentId, AI_ANALYSIS_STATUS.SKIPPED_NO_KEY);
      return;
    }

    const pending = await this.prisma.aiAnalysis.create({
      data: {
        incidentId: params.incidentId,
        modelVersion: DEFAULT_META_MODEL,
        status: AI_ANALYSIS_STATUS.PENDING,
        resultJson: { requires_human_review: true },
      },
    });

    const result = await provider.classify({ plaintext });

    if (result.ok === false) {
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
