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

export type OperatorAttachmentSummary = {
  id: string;
  kind: 'audio' | 'photo';
  mime: string;
  sizeBytes: number;
  durationMs: number | null;
  createdAt: string;
  transcriptStatus: 'pending' | 'processing' | 'completed' | 'failed' | null;
  visionStatus: 'pending' | 'processing' | 'completed' | 'failed' | null;
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
  attachments?: OperatorAttachmentSummary[];
  timeline: {
    id: string;
    deliveryState: string;
    source: string;
    createdAt: string;
  }[];
  audit: OperatorCaseAuditEntry[];
};

export const AI_DRAFT_LABEL = 'öneri/taslak, doğrulanmadı' as const;

export type ReviewStatus = 'NEW' | 'SEEN' | 'UNDER_REVIEW' | 'COORDINATING';

const REVIEW_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  NEW: ['SEEN', 'UNDER_REVIEW'],
  SEEN: ['UNDER_REVIEW', 'COORDINATING'],
  UNDER_REVIEW: ['COORDINATING', 'SEEN'],
  COORDINATING: ['UNDER_REVIEW'],
};

export function getValidTransitions(currentStatus: string): ReviewStatus[] {
  const status = currentStatus as ReviewStatus;
  return REVIEW_TRANSITIONS[status] || [];
}

function humanizeStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getReviewStatusLabel(status: string, t: (key: string) => string): string {
  const key = `web.reviewStatuses.${status}`;
  const translated = t(key);
  return translated !== key ? translated : humanizeStatus(status);
}

export function getReviewStatusOptions(t: (key: string) => string) {
  return [
    { value: 'SEEN' as const, label: getReviewStatusLabel('SEEN', t) },
    { value: 'UNDER_REVIEW' as const, label: getReviewStatusLabel('UNDER_REVIEW', t) },
    { value: 'COORDINATING' as const, label: getReviewStatusLabel('COORDINATING', t) },
  ];
}
