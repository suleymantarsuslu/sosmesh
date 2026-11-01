import { DeliveryState } from '@prisma/client';

/** Minimal delivery chart aligned with packages/fixtures/transport/state-transitions.json */
const VALID: Record<DeliveryState, DeliveryState[]> = {
  LOCAL_SAVED: ['PEER_RECEIVED', 'FAILED', 'EXPIRED'],
  PEER_RECEIVED: ['SERVER_ACCEPTED', 'FAILED', 'EXPIRED'],
  SERVER_ACCEPTED: ['OPERATOR_SEEN', 'FAILED', 'EXPIRED'],
  OPERATOR_SEEN: ['CASE_IN_PROGRESS', 'FAILED', 'EXPIRED'],
  CASE_IN_PROGRESS: ['FAILED', 'EXPIRED'],
  FAILED: [],
  EXPIRED: [],
};

export function canTransitionDelivery(from: DeliveryState, to: DeliveryState): boolean {
  if (from === to) {
    return true;
  }
  return VALID[from]?.includes(to) ?? false;
}
