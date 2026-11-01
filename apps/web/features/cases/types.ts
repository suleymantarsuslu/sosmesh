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
  verifiedMetadata: {
    personCount: number | null;
    locationStatus: string;
    latitude: number | null;
    longitude: number | null;
    accuracyMeters: number | null;
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

export const REVIEW_STATUS_OPTIONS = [
  { value: 'SEEN', label: 'Görüldü' },
  { value: 'UNDER_REVIEW', label: 'İncelemede' },
  { value: 'COORDINATING', label: 'Koordine ediliyor' },
] as const;
