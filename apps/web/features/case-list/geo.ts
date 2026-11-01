import type { OperatorCaseRow } from './types';

/** Synthetic demo anchor — not a real victim location. */
export const SYNTHETIC_MAP_CENTER = { lat: 39.9334, lng: 32.8597 };

export function hasPlottableCoordinates(row: Pick<
  OperatorCaseRow,
  'latitude' | 'longitude' | 'locationStatus'
>): boolean {
  if (row.locationStatus === 'UNKNOWN') {
    return false;
  }
  if (row.latitude == null || row.longitude == null) {
    return false;
  }
  if (row.latitude === 0 && row.longitude === 0) {
    return false;
  }
  return true;
}

export function isUnknownLocationQueue(row: Pick<
  OperatorCaseRow,
  'latitude' | 'longitude' | 'locationStatus'
>): boolean {
  return !hasPlottableCoordinates(row);
}

/** Visual radius: low accuracy → larger, uncertain circle (never implies precision). */
export function accuracyCircleRadiusMeters(accuracyMeters: number | null): number {
  if (accuracyMeters == null || !Number.isFinite(accuracyMeters) || accuracyMeters <= 0) {
    return 800;
  }
  const capped = Math.min(accuracyMeters, 5000);
  return Math.max(40, capped * 1.15);
}

export function accuracyVisualOpacity(accuracyMeters: number | null): number {
  if (accuracyMeters == null || accuracyMeters > 500) {
    return 0.18;
  }
  if (accuracyMeters > 100) {
    return 0.28;
  }
  return 0.38;
}
