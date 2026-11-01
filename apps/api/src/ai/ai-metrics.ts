export type AiMetricSnapshot = {
  classifyAttempts: number;
  classifyCompleted: number;
  classifyFailed: number;
  classifyFallback: number;
  skippedDisabled: number;
  skippedRateLimit: number;
  skippedCostCap: number;
  skippedIncidentTokenBudget: number;
  skippedNoKey: number;
  estimatedUsdCharged: number;
  incidentTokensEstimated: number;
};

export class AiRunMetrics {
  private snapshot: AiMetricSnapshot = {
    classifyAttempts: 0,
    classifyCompleted: 0,
    classifyFailed: 0,
    classifyFallback: 0,
    skippedDisabled: 0,
    skippedRateLimit: 0,
    skippedCostCap: 0,
    skippedIncidentTokenBudget: 0,
    skippedNoKey: 0,
    estimatedUsdCharged: 0,
    incidentTokensEstimated: 0,
  };

  recordAttempt(): void {
    this.snapshot.classifyAttempts += 1;
  }

  recordCompleted(): void {
    this.snapshot.classifyCompleted += 1;
  }

  recordFailed(): void {
    this.snapshot.classifyFailed += 1;
  }

  recordFallback(): void {
    this.snapshot.classifyFallback += 1;
  }

  recordSkip(kind: keyof Pick<
    AiMetricSnapshot,
    | 'skippedDisabled'
    | 'skippedRateLimit'
    | 'skippedCostCap'
    | 'skippedIncidentTokenBudget'
    | 'skippedNoKey'
  >): void {
    this.snapshot[kind] += 1;
  }

  recordCostUsd(amount: number): void {
    this.snapshot.estimatedUsdCharged += amount;
  }

  recordIncidentTokens(amount: number): void {
    this.snapshot.incidentTokensEstimated += amount;
  }

  getSnapshot(): AiMetricSnapshot {
    return { ...this.snapshot };
  }

  reset(): void {
    this.snapshot = {
      classifyAttempts: 0,
      classifyCompleted: 0,
      classifyFailed: 0,
      classifyFallback: 0,
      skippedDisabled: 0,
      skippedRateLimit: 0,
      skippedCostCap: 0,
      skippedIncidentTokenBudget: 0,
      skippedNoKey: 0,
      estimatedUsdCharged: 0,
      incidentTokensEstimated: 0,
    };
  }
}

let globalMetrics: AiRunMetrics | null = null;

export function getAiRunMetrics(): AiRunMetrics {
  if (!globalMetrics) {
    globalMetrics = new AiRunMetrics();
  }
  return globalMetrics;
}

export function resetAiRunMetricsForTests(): void {
  globalMetrics = new AiRunMetrics();
}
