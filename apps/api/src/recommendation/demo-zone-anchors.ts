/**
 * Synthetic demo anchor coordinates for approved resource catalog (not real deployments).
 * Used only for deterministic distance ranking in ADIM 46.
 */
export const DEMO_ZONE_ANCHORS: Record<string, { latitude: number; longitude: number }> = {
  'SYNTH-Z1': { latitude: 39.92, longitude: 32.85 },
  'Z-C1': { latitude: 39.93, longitude: 32.86 },
  'SYNTH-RESCUE-A': { latitude: 39.915, longitude: 32.845 },
  'SYNTH-RESCUE-B': { latitude: 39.94, longitude: 32.88 },
};

export function resolveZoneAnchor(zoneCode: string | null | undefined): {
  latitude: number;
  longitude: number;
  synthetic: boolean;
} {
  if (zoneCode && DEMO_ZONE_ANCHORS[zoneCode]) {
    return { ...DEMO_ZONE_ANCHORS[zoneCode], synthetic: true };
  }
  return { latitude: 39.925, longitude: 32.836, synthetic: true };
}
