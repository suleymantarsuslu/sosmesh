import { OperatorReviewStatus } from '@prisma/client';

const REVIEW_TRANSITIONS: Record<OperatorReviewStatus, OperatorReviewStatus[]> = {
  NEW: ['SEEN', 'UNDER_REVIEW'],
  SEEN: ['UNDER_REVIEW', 'COORDINATING'],
  UNDER_REVIEW: ['COORDINATING', 'SEEN'],
  COORDINATING: ['UNDER_REVIEW'],
};

export function canTransitionReview(
  from: OperatorReviewStatus,
  to: OperatorReviewStatus
): boolean {
  if (from === to) {
    return true;
  }
  return REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

export const REVIEW_STATUS_LABELS: Record<OperatorReviewStatus, string> = {
  NEW: 'Yeni',
  SEEN: 'Görüldü',
  UNDER_REVIEW: 'İncelemede',
  COORDINATING: 'Koordine ediliyor',
};
