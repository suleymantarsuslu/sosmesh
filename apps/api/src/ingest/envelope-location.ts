import { HttpException, HttpStatus } from '@nestjs/common';
import { LocationStatus, Prisma } from '@prisma/client';

export type EnvelopeGeoFields = {
  locationStatus: LocationStatus;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  accuracyMeters: number | null;
};

function parseLocationStatus(raw: unknown): LocationStatus | null {
  if (raw === 'UNKNOWN' || raw === 'GPS' || raw === 'MANUAL') {
    return raw as LocationStatus;
  }
  return null;
}

export function parseEnvelopeGeo(envelope: Record<string, unknown>): EnvelopeGeoFields {
  const explicitStatus = parseLocationStatus(envelope.locationStatus);

  if (explicitStatus === LocationStatus.UNKNOWN) {
    if (envelope.location !== null && envelope.location !== undefined) {
      throw new HttpException(
        {
          code: 'INVALID_ENVELOPE_LOCATION',
          message: 'UNKNOWN locationStatus requires null location',
        },
        HttpStatus.BAD_REQUEST
      );
    }
    return {
      locationStatus: LocationStatus.UNKNOWN,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
    };
  }

  const location = envelope.location;
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    throw new HttpException(
      {
        code: 'INVALID_ENVELOPE_LOCATION',
        message: 'Envelope location coordinates are required',
      },
      HttpStatus.BAD_REQUEST
    );
  }

  const coords = location as Record<string, unknown>;
  const latitude = coords.latitude;
  const longitude = coords.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new HttpException(
      {
        code: 'INVALID_ENVELOPE_LOCATION',
        message: 'Envelope location coordinates are invalid',
      },
      HttpStatus.BAD_REQUEST
    );
  }

  let locationStatus: LocationStatus = LocationStatus.GPS;
  if (explicitStatus === LocationStatus.MANUAL) {
    locationStatus = LocationStatus.MANUAL;
  } else if (explicitStatus === LocationStatus.GPS) {
    locationStatus = LocationStatus.GPS;
  }

  return {
    locationStatus,
    latitude: new Prisma.Decimal(String(latitude)),
    longitude: new Prisma.Decimal(String(longitude)),
    accuracyMeters: typeof coords.accuracy === 'number' ? coords.accuracy : null,
  };
}

export function isUnknownLocationEnvelope(envelope: Record<string, unknown>): boolean {
  return envelope.locationStatus === 'UNKNOWN';
}
