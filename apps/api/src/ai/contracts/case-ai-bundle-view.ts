/**
 * Case AI Bundle View Contract - Operator API response shape
 * One call for everything the case detail AI panel renders.
 * `samVision` is always null here: segmentation masks are heavy and are served by
 * GET /v1/operator/attachments/:id/masks.
 */

import type { AiTriageView } from './ai-triage-view';
import type { IncidentLinkSuggestionView } from './link-suggestion-view';
import type { TranscriptView } from './transcript-view';

export type SparkVisionPanelView = {
  attachmentId: string;
  model: string;
  summary: {
    description: string;
    visibleObjects: string[];
    estimatedPersonCount: number | null;
    hazardsVisible: string[];
    uncertainty: string | null;
    possiblePeopleIndicators: string | null;
    accessIssues: string[];
    confidence: 'low' | 'medium' | 'high' | null;
  };
  analyzedAt: string;
};

export type CaseAiBundleView = {
  triage: AiTriageView | null;
  transcript: TranscriptView | null;
  sparkVision: SparkVisionPanelView | null;
  samVision: null;
  linkSuggestions: IncidentLinkSuggestionView[];
};
