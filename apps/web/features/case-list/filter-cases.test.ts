import { describe, expect, it } from 'vitest';

import { applyCaseFilters, defaultCaseFilters } from './filter-cases';
import type { OperatorCaseRow } from './types';

const sample: OperatorCaseRow[] = [
  {
    incidentId: '11111111-1111-4111-8111-111111111111',
    incidentState: 'PENDING',
    messageId: 'alpha-medical',
    sosMessageId: 'alpha-medical',
    priority: 1,
    sosType: 'MEDICAL',
    deliveryState: 'SERVER_ACCEPTED',
    locationStatus: 'GPS',
    latitude: 39.9,
    longitude: 32.8,
    accuracyMeters: 40,
    receivedAt: '2026-11-01T00:00:00.000Z',
    source: 'relay-a',
  },
  {
    incidentId: '22222222-2222-4222-8222-222222222222',
    incidentState: 'PENDING',
    messageId: 'beta-general',
    sosMessageId: 'beta-general',
    priority: 3,
    sosType: 'GENERAL',
    deliveryState: 'SERVER_ACCEPTED',
    locationStatus: 'UNKNOWN',
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    receivedAt: '2026-11-01T01:00:00.000Z',
    source: 'relay-b',
  },
];

describe('applyCaseFilters', () => {
  it('filters by search and category', () => {
    const filters = { ...defaultCaseFilters(), search: 'alpha', category: 'MEDICAL' };
    const result = applyCaseFilters(sample, filters);
    expect(result).toHaveLength(1);
    expect(result[0].messageId).toBe('alpha-medical');
  });

  it('filters by accuracy ceiling', () => {
    const filters = { ...defaultCaseFilters(), accuracyMax: '50' };
    const result = applyCaseFilters(sample, filters);
    expect(result.map((row) => row.messageId)).toEqual(['alpha-medical']);
  });
});
