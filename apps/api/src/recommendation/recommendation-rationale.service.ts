import { Injectable, Optional } from '@nestjs/common';

import { AiCostGuard, IncidentTokenBudgetGuard, TenantAiRateLimiter } from '../ai/ai-guards';
import { DEFAULT_ESTIMATED_TOKENS_PER_CLASSIFY, DEFAULT_INCIDENT_TOKEN_BUDGET } from '../ai/ai.constants';
import { getAiRunMetrics } from '../ai/ai-metrics';
import { deidentifySosPlaintextForPrompt } from '../ai/deidentify-plaintext';
import { EVAL_FIXTURES } from '../ai/evals/fixtures';
import {
  buildMetaProviderFromEnv,
  buildMockMetaProvider,
  type MetaProvider,
} from '../ai/providers/meta';
import { buildSafeFallbackSosAiOutput } from '../ai/schemas/safe-fallback';

const FORBIDDEN_RATIONALE =
  /team_assignment|triage_decision|treatment_plan|rescue_plan|dispatch_now|assigned_team/i;

export type OptionalAiRationaleResult = {
  text: string | null;
  skippedReason: string | null;
};

@Injectable()
export class RecommendationRationaleService {
  private readonly tenantLimiter: TenantAiRateLimiter;
  private readonly costGuard: AiCostGuard;
  private readonly incidentTokenBudget: IncidentTokenBudgetGuard;
  private readonly provider: MetaProvider;

  constructor(@Optional() providerOverride: MetaProvider | null = null) {
    this.tenantLimiter = new TenantAiRateLimiter(
      Number(process.env.AI_TENANT_RATE_LIMIT_MAX ?? 30),
      Number(process.env.AI_TENANT_RATE_LIMIT_WINDOW_MS ?? 60_000)
    );
    this.costGuard = new AiCostGuard(() => Number(process.env.AI_DAILY_COST_CAP_USD ?? 5));
    this.incidentTokenBudget = new IncidentTokenBudgetGuard(
      Number(process.env.AI_INCIDENT_TOKEN_BUDGET ?? DEFAULT_INCIDENT_TOKEN_BUDGET)
    );
    if (providerOverride) {
      this.provider = providerOverride;
    } else if (process.env.NODE_ENV === 'test' || !process.env.MODEL_API_KEY) {
      this.provider = buildMockMetaProvider(EVAL_FIXTURES);
    } else {
      const fromEnv = buildMetaProviderFromEnv(process.env);
      this.provider = fromEnv ?? buildMockMetaProvider(EVAL_FIXTURES);
    }
  }

  async maybeBuildAiRationale(params: {
    incidentId: string;
    tenantKey: string;
    operatorDisplayText: string | null;
    deterministicNote: string;
    optIn: boolean;
  }): Promise<OptionalAiRationaleResult> {
    if (!params.optIn) {
      return { text: null, skippedReason: 'opt_in_required' };
    }
    if (process.env.AI_RECOMMENDATION_RATIONALE_ENABLED !== 'true') {
      return { text: null, skippedReason: 'feature_disabled' };
    }
    if (process.env.AI_ENABLED === 'false') {
      return { text: null, skippedReason: 'ai_disabled' };
    }

    const metrics = getAiRunMetrics();
    if (!this.tenantLimiter.tryConsume(params.tenantKey)) {
      metrics.recordSkip('skippedRateLimit');
      return { text: this.fallbackRationale(params.deterministicNote), skippedReason: 'rate_limit' };
    }

    const estimatedCost = Number(process.env.AI_ESTIMATED_COST_USD ?? 0.002);
    if (!this.costGuard.tryCharge(estimatedCost)) {
      metrics.recordSkip('skippedCostCap');
      return { text: this.fallbackRationale(params.deterministicNote), skippedReason: 'cost_cap' };
    }
    metrics.recordCostUsd(estimatedCost);

    const estimatedTokens = Number(
      process.env.AI_ESTIMATED_TOKENS_PER_CLASSIFY ?? DEFAULT_ESTIMATED_TOKENS_PER_CLASSIFY
    );
    if (!this.incidentTokenBudget.tryConsume(params.incidentId, estimatedTokens)) {
      metrics.recordSkip('skippedIncidentTokenBudget');
      return {
        text: this.fallbackRationale(params.deterministicNote),
        skippedReason: 'incident_token_budget',
      };
    }
    metrics.recordIncidentTokens(estimatedTokens);
    metrics.recordAttempt();

    const plaintext = deidentifySosPlaintextForPrompt(
      params.operatorDisplayText ?? 'recommendation_rationale_only'
    );
    const result = await this.provider.classify({
      plaintext: `recommendation_rationale_only ${plaintext}`,
      languageHint: 'tr',
    });

    if (result.ok === false) {
      metrics.recordFailed();
      metrics.recordFallback();
      return {
        text: this.fallbackRationale(params.deterministicNote),
        skippedReason: result.reason,
      };
    }

    const safe = buildSafeFallbackSosAiOutput({
      language: result.output.language,
      reason: 'recommendation_rationale_guard',
    });
    const summary = [
      'AI yardım metni (öneri; karar koordinatördedir):',
      `aciliyet=${result.output.urgency_suggestion}`,
      `belirsizlik=${result.output.uncertainty}`,
      `güvenli_yedek_belirsizlik=${safe.uncertainty}`,
    ].join(' ');

    if (FORBIDDEN_RATIONALE.test(summary)) {
      metrics.recordFallback();
      return {
        text: this.fallbackRationale(params.deterministicNote),
        skippedReason: 'forbidden_content',
      };
    }

    metrics.recordCompleted();
    return { text: summary, skippedReason: null };
  }

  private fallbackRationale(deterministicNote: string): string {
    return `Deterministik eşleştirme: ${deterministicNote}`;
  }
}
