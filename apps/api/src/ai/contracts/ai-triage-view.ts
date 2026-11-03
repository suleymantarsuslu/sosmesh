/**
 * AI Triage View Contract - Operator API response shape
 * Work Package A - AI Foundation
 */

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
