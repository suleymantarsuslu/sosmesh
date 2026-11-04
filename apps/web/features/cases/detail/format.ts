export function formatAccuracyMeters(meters: number | null | undefined): string | null {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return null;
  return String(Math.max(0, Math.round(meters)));
}

export function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

export function formatCoordinatePair(latitude: number, longitude: number): string {
  return `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
}

export function openStreetMapUrl(latitude: number, longitude: number): string {
  const lat = formatCoordinate(latitude);
  const lon = formatCoordinate(longitude);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.split(`{{${key}}}`).join(String(value)),
    template
  );
}

export const SEGMENT_COLORS = ['#ff3366', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4'];

export function segmentColor(index: number): string {
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length];
}
