/**
 * AI Status View Contract - Operator API response shape
 * Work Package A - AI Foundation
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export type AiStatusView = {
  enabled: boolean;
  circuitState: CircuitState;
  budgetUsedToday: number;
  budgetTotalLimit: number;
  budgetDailyLimit: number;
  lastAnalysisAt: string | null;
  queueDepth: number;
  modelsAvailable: {
    spark: boolean;
    asr: boolean;
    sam: boolean;
  };
};
