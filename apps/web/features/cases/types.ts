import type { TranscriptView } from '../ai/types';
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

/**
 * Transcript as returned in the case detail. Translation fields are optional: the API does
 * not expose a transcript translation yet, so they render only when present.
 */
export type OperatorTranscript = TranscriptView & {
  translatedTranscript?: string | null;
  translatedText?: string | null;
  translationLanguage?: string | null;
};


/** Mesh v2 sender profile (decrypted server-side, operators only). Every field optional. */
export type SenderProfile = {
  fullName?: string;
  age?: number;
  address?: { line?: string; district?: string; city?: string; postalCode?: string; country?: string };
  floor?: number;
  phone?: string;
  email?: string;
  householdSize?: number;
};

export type CaseSenderView = {
  profile: SenderProfile | null;
  /** Inference only; never dispatches. */
  assumption: {
    kind: 'AT_REGISTERED_ADDRESS';
    inference: true;
    distanceMeters: number;
    floor: number | null;
    personCount: number | null;
  } | null;
  mergedMessageCount: number;
  mergedMessages: {
    messageId: string;
    receivedAt: string;
    hasNote: boolean;
    hasLocation: boolean;
    personCount: number | null;
  }[];
};

export type OperatorCaseDetail = OperatorCaseRow & {
  /** Mesh v2 sender block; null/absent for v1 incidents. */
  sender?: CaseSenderView | null;
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
  transcripts?: OperatorTranscript[];
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
