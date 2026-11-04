import type { InnerLocationV2, SenderProfileV2 } from './inner-payload-v2';

/** Spec §13: both the GPS accuracy and the distance to the device-geocoded home must be within 100 m. */
export const ASSUMPTION_RADIUS_METERS = 100;
export const ASSUMPTION_MAX_ACCURACY_METERS = 100;

export type AddressAssumption = {
  kind: 'AT_REGISTERED_ADDRESS';
  /** Always an inference; never dispatches or changes priority. */
  inference: true;
  distanceMeters: number;
  floor: number | null;
  personCount: number | null;
};

export function haversineMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * No server geocoder: the device geocodes the address at onboarding and sends `profile.homeLocation`.
 * Returns null whenever any input is missing, so the card simply does not render.
 */
export function computeAddressAssumption(
  location: Pick<InnerLocationV2, 'latitude' | 'longitude' | 'accuracyMeters'> | null,
  profile: SenderProfileV2 | null,
  personCount: number | null
): AddressAssumption | null {
  if (!location || !profile?.homeLocation) {
    return null;
  }
  if (typeof location.accuracyMeters !== 'number' || location.accuracyMeters > ASSUMPTION_MAX_ACCURACY_METERS) {
    return null;
  }
  const distance = haversineMeters(
    location.latitude,
    location.longitude,
    profile.homeLocation.latitude,
    profile.homeLocation.longitude
  );
  if (distance > ASSUMPTION_RADIUS_METERS) {
    return null;
  }
  return {
    kind: 'AT_REGISTERED_ADDRESS',
    inference: true,
    distanceMeters: Math.round(distance),
    floor: profile.floor ?? null,
    personCount: personCount ?? profile.householdSize ?? null,
  };
}
