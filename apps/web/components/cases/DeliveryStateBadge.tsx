'use client';

import { useOperatorPreferences } from '../operator/OperatorPreferencesProvider';

const DELIVERY_KEYS = [
  'LOCAL_SAVED',
  'PEER_RECEIVED',
  'SERVER_ACCEPTED',
  'OPERATOR_SEEN',
  'CASE_IN_PROGRESS',
] as const;

function normalizeState(state: string): string {
  const upper = state.toUpperCase().replace(/\s+/g, '_');
  for (const key of DELIVERY_KEYS) {
    if (upper.includes(key)) {
      return key;
    }
  }
  return upper;
}

function badgeModifier(state: string): string {
  const key = normalizeState(state);
  switch (key) {
    case 'LOCAL_SAVED':
      return 'delivery-badge--local';
    case 'PEER_RECEIVED':
      return 'delivery-badge--peer';
    case 'SERVER_ACCEPTED':
      return 'delivery-badge--server';
    case 'OPERATOR_SEEN':
      return 'delivery-badge--operator';
    case 'CASE_IN_PROGRESS':
      return 'delivery-badge--progress';
    default:
      return 'delivery-badge--unknown';
  }
}

export function DeliveryStateBadge({
  state,
  testId,
}: {
  state: string;
  testId?: string;
}) {
  const { t } = useOperatorPreferences();
  const key = normalizeState(state);
  const labelKey = `web.delivery.${key}` as const;
  const label =
    DELIVERY_KEYS.includes(key as (typeof DELIVERY_KEYS)[number]) &&
    t(labelKey) !== labelKey
      ? t(labelKey)
      : t('web.delivery.unknown');

  return (
    <span
      className={`delivery-badge ${badgeModifier(state)}`}
      data-testid={testId ?? `delivery-badge-${key.toLowerCase()}`}
    >
      {label}
    </span>
  );
}
