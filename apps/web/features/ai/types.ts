export type UrgencySuggestion = 'critical' | 'high' | 'medium' | 'low' | 'unknown';

export type AiTriageView = {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'requires_review' | 'unavailable';
  modelVersion: string | null;
  eventType: string | null;
  reportedPersonCount: number | null;
  needs: string[];
  hazards: string[];
  urgencySuggestion: UrgencySuggestion | null;
  missingInfo: string[];
  summary: string | null;
  nextStepSuggestion: string | null;
  sourceQuotes: Array<{
    text: string;
    field?: string;
  }>;
  translation: {
    language: string;
    text: string;
    uncertain: boolean;
  } | null;
  followUpQuestions: string[];
  operatorOverride: {
    urgency?: UrgencySuggestion;
    summary?: string;
    overriddenBy: string;
    overriddenAt: string;
  } | null;
  analyzedAt: string | null;
};

export type TranscriptTurn = {
  turnId: number;
  startMs: number;
  endMs: number;
  transcript: string;
  speaker?: string;
};

export type TranscriptView = {
  attachmentId: string;
  model: string;
  transcript: string;
  turns: TranscriptTurn[];
  language: string | null;
  audioDurationMs: number | null;
  createdAt: string;
};

export type SparkVisionSummary = {
  description: string;
  visibleObjects: string[];
  estimatedPersonCount: number | null;
  hazardsVisible: string[];
  uncertainty: string | null;
};

export type SamSegmentResult = {
  id: string;
  concept: string;
  confidence: number | null;
  boundingBox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    height: number;
  };
  mask: {
    x: number;
    y: number;
    width: number;
    height: number;
    encoding: string;
    data: string;
  } | null;
};

export type SparkVisionView = {
  attachmentId: string;
  model: string;
  summary: SparkVisionSummary;
  analyzedAt: string;
};

export type SamVisionView = {
  attachmentId: string;
  model: string;
  results: SamSegmentResult[];
  analyzedAt: string;
};

export type DeterministicSignals = {
  distanceMeters: number | null;
  timeDeltaSeconds: number;
  locationProximity: boolean;
  timeProximity: boolean;
  sosTypeMatch: boolean;
  tokenOverlap: number;
};

export type IncidentLinkSuggestionView = {
  id: string;
  incidentAId: string;
  incidentBId: string;
  score: number;
  deterministicSignals: DeterministicSignals;
  aiRationale: string | null;
  status: 'suggested' | 'confirmed' | 'rejected';
  decidedBy: {
    userId: string;
    displayName: string;
  } | null;
  decidedAt: string | null;
  createdAt: string;
};

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
