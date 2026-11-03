import type { OperatorCaseRow } from '../case-list/types';

export type OperatorAiSuggestion = {
  status: string;
  modelVersion: string;
  suggestion: Record<string, unknown> | null;
  verified: false;
  label: 'öneri/taslak, doğrulanmadı';
};

export type OperatorCaseAuditEntry = {
  id: string;
  action: string;
  actorId: string | null;
  actorDisplayName: string | null;
  createdAt: string;
  before: unknown;
  after: unknown;
};

export type OperatorCaseDetail = OperatorCaseRow & {
  version: number;
  reviewStatus: string;
  originalText: string | null;
  translatedText: string | null;
  detectedLanguage: string | null;
  verifiedMetadata: {
    personCount: number | null;
    locationStatus: string;
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
    locationApproximate: boolean;
  };
  ai: OperatorAiSuggestion | null;
  timeline: {
    id: string;
    deliveryState: string;
    source: string;
    createdAt: string;
  }[];
  audit: OperatorCaseAuditEntry[];
};

export const AI_DRAFT_LABEL = 'öneri/taslak, doğrulanmadı' as const;

export function getReviewStatusOptions(t: (key: string) => string) {
  return [
    { value: 'SEEN' as const, label: t('web.dashboard.states.seen') },
    { value: 'UNDER_REVIEW' as const, label: t('web.cases.stateUnderReview') },
    { value: 'COORDINATING' as const, label: t('web.cases.stateCoordinating') },
  ];
}
