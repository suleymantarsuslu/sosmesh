import { BadRequestException } from '@nestjs/common';
import { LocationStatus, Prisma } from '@prisma/client';

export type MetadataCorrectionInput = {
  personCount?: number | null;
  locationStatus?: LocationStatus;
  latitude?: number | null;
  longitude?: number | null;
};

export type MetadataSnapshot = {
  personCount: number | null;
  locationStatus: LocationStatus;
  latitude: number | null;
  longitude: number | null;
};

function assertLatLonRange(latitude: number, longitude: number): void {
  if (latitude < -90 || latitude > 90) {
    throw new BadRequestException({
      code: 'INVALID_LATITUDE',
      message: 'latitude must be between -90 and 90',
    });
  }
  if (longitude < -180 || longitude > 180) {
    throw new BadRequestException({
      code: 'INVALID_LONGITUDE',
      message: 'longitude must be between -180 and 180',
    });
  }
}

export function buildMetadataCorrectionUpdate(
  current: MetadataSnapshot,
  input: MetadataCorrectionInput
): { data: Prisma.SosMessageUpdateInput; before: MetadataSnapshot; after: MetadataSnapshot } {
  const nextStatus = input.locationStatus ?? current.locationStatus;
  let nextLat = input.latitude !== undefined ? input.latitude : current.latitude;
  let nextLon = input.longitude !== undefined ? input.longitude : current.longitude;

  if (nextStatus === LocationStatus.UNKNOWN) {
    if (
      (input.latitude !== undefined && input.latitude !== null) ||
      (input.longitude !== undefined && input.longitude !== null)
    ) {
      throw new BadRequestException({
        code: 'LOCATION_INCONSISTENT',
        message: 'UNKNOWN location cannot include coordinates',
      });
    }
    nextLat = null;
    nextLon = null;
  }

  if (nextStatus === LocationStatus.GPS || nextStatus === LocationStatus.MANUAL) {
    if (nextLat === null || nextLon === null) {
      throw new BadRequestException({
        code: 'LOCATION_COORDINATES_REQUIRED',
        message: 'GPS/MANUAL location requires latitude and longitude',
      });
    }
    assertLatLonRange(nextLat, nextLon);
  }

  if (input.latitude !== undefined && input.latitude !== null) {
    assertLatLonRange(input.latitude, nextLon ?? 0);
  }
  if (input.longitude !== undefined && input.longitude !== null) {
    assertLatLonRange(nextLat ?? 0, input.longitude);
  }

  if (
    current.locationStatus === LocationStatus.UNKNOWN &&
    nextStatus !== LocationStatus.UNKNOWN &&
    input.locationStatus === undefined &&
    (nextLat === null || nextLon === null)
  ) {
    throw new BadRequestException({
      code: 'LOCATION_INCONSISTENT',
      message: 'Cannot keep coordinates without a GPS/MANUAL location status',
    });
  }

  const before: MetadataSnapshot = { ...current };
  const after: MetadataSnapshot = {
    personCount: input.personCount !== undefined ? input.personCount : current.personCount,
    locationStatus: nextStatus,
    latitude: nextLat,
    longitude: nextLon,
  };

  const data: Prisma.SosMessageUpdateInput = {};
  if (input.personCount !== undefined) {
    data.personCount = input.personCount;
  }
  if (
    input.locationStatus !== undefined ||
    input.latitude !== undefined ||
    input.longitude !== undefined
  ) {
    data.locationStatus = after.locationStatus;
    data.latitude = after.latitude;
    data.longitude = after.longitude;
  }

  return { data, before, after };
}
