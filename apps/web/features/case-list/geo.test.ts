import { describe, expect, it } from 'vitest';

import {
  accuracyCircleRadiusMeters,
  hasPlottableCoordinates,
  isUnknownLocationQueue,
} from './geo';
import type { OperatorCaseRow } from './types';

function row(
  partial: Partial<OperatorCaseRow> & Pick<OperatorCaseRow, 'incidentId'>
): OperatorCaseRow {
  return {
    incidentState: 'PENDING',
    messageId: 'msg',
    sosMessageId: 'msg',
    priority: 2,
    sosType: 'GENERAL',
    deliveryState: 'SERVER_ACCEPTED',
    locationStatus: 'GPS',
    latitude: 39.9,
    longitude: 32.8,
    accuracyMeters: 100,
    receivedAt: '2026-11-01T00:00:00.000Z',
    source: null,
    ...partial,
  };
}

describe('geo helpers', () => {
  it('does not plot unknown or null coordinates', () => {
    expect(hasPlottableCoordinates(row({ incidentId: 'a', locationStatus: 'UNKNOWN' }))).toBe(
      false
    );
    expect(
      hasPlottableCoordinates(
        row({ incidentId: 'b', latitude: null, longitude: null, locationStatus: 'GPS' })
      )
    ).toBe(false);
    expect(
      hasPlottableCoordinates(row({ incidentId: 'c', latitude: 0, longitude: 0, locationStatus: 'GPS' }))
    ).toBe(false);
  });

  it('routes non-plottable cases to unknown queue', () => {
    const unknown = row({ incidentId: 'u', locationStatus: 'UNKNOWN', latitude: null, longitude: null });
    expect(isUnknownLocationQueue(unknown)).toBe(true);
    expect(hasPlottableCoordinates(unknown)).toBe(false);
  });

  it('never shrinks low-accuracy below visible uncertainty', () => {
    expect(accuracyCircleRadiusMeters(null)).toBeGreaterThanOrEqual(800);
    expect(accuracyCircleRadiusMeters(5000)).toBeLessThanOrEqual(5750);
  });
});
