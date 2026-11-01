import { LocationStatus } from '@prisma/client';

import { resolveZoneAnchor } from './demo-zone-anchors';

export type IncidentLocationContext = {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  locationStatus: LocationStatus;
  receivedAt: Date;
  incidentUpdatedAt: Date;
  now: Date;
};

export type ResourceMatchCandidate = {
  resourceId: string;
  resourceName: string;
  teamId: string;
  teamName: string;
  zoneCode: string | null;
  capacity: number;
  openTaskCount: number;
  isActive: boolean;
  isAvailableWindow: boolean;
};

export type MatchDiagnostics = {
  missingInfo: string[];
  dataFreshness: {
    sosReceivedAt: string;
    ageMinutes: number;
    stale: boolean;
    staleThresholdMinutes: number;
  };
  locationQuality: 'unknown' | 'low_accuracy' | 'usable' | 'missing_coordinates';
};

export type RankedResourceMatch = ResourceMatchCandidate & {
  rank: number;
  distanceKm: number | null;
  available: boolean;
  deterministicNote: string;
  diagnostics: MatchDiagnostics;
};

const STALE_CASE_MINUTES = 120;
const LOW_ACCURACY_METERS = 1500;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildMatchDiagnostics(ctx: IncidentLocationContext): MatchDiagnostics {
  const missingInfo: string[] = [];
  let locationQuality: MatchDiagnostics['locationQuality'] = 'usable';

  if (ctx.locationStatus === LocationStatus.UNKNOWN) {
    missingInfo.push('Konum durumu bilinmiyor; mesafe sıralaması sentetik bölge merkezine göredir.');
    locationQuality = 'unknown';
  }
  if (ctx.latitude === null || ctx.longitude === null) {
    missingInfo.push('Vaka koordinatı yok; otomatik fiziksel sevk yapılmaz.');
    locationQuality = 'missing_coordinates';
  } else if (
    ctx.accuracyMeters !== null &&
    ctx.accuracyMeters > LOW_ACCURACY_METERS
  ) {
    missingInfo.push('GPS doğruluğu düşük; mesafe tahmini güvenilmez olabilir.');
    locationQuality = 'low_accuracy';
  }

  const ageMinutes = Math.max(
    0,
    Math.floor((ctx.now.getTime() - ctx.receivedAt.getTime()) / 60_000)
  );
  const stale = ageMinutes >= STALE_CASE_MINUTES;
  if (stale) {
    missingInfo.push('Vaka verisi bayat; öneri yalnızca taslaktır.');
  }

  return {
    missingInfo,
    dataFreshness: {
      sosReceivedAt: ctx.receivedAt.toISOString(),
      ageMinutes,
      stale,
      staleThresholdMinutes: STALE_CASE_MINUTES,
    },
    locationQuality,
  };
}

function resourceAvailable(candidate: ResourceMatchCandidate): boolean {
  if (!candidate.isActive || !candidate.isAvailableWindow) {
    return false;
  }
  if (candidate.openTaskCount >= candidate.capacity) {
    return false;
  }
  return true;
}

export function rankResourceMatches(params: {
  incident: IncidentLocationContext;
  candidates: ResourceMatchCandidate[];
}): RankedResourceMatch[] {
  const diagnostics = buildMatchDiagnostics(params.incident);
  const incidentLat = params.incident.latitude;
  const incidentLon = params.incident.longitude;

  const scored = params.candidates.map((candidate) => {
    const anchor = resolveZoneAnchor(candidate.zoneCode);
    let distanceKm: number | null = null;
    if (incidentLat !== null && incidentLon !== null) {
      distanceKm = haversineKm(
        incidentLat,
        incidentLon,
        anchor.latitude,
        anchor.longitude
      );
    }
    const available = resourceAvailable(candidate);
    const noteParts = [
      available
        ? `${candidate.teamName} / ${candidate.resourceName} müsait görünüyor (sentetik katalog).`
        : `${candidate.teamName} şu an müsait değil veya kapasite dolu.`,
      distanceKm !== null
        ? `Tahmini mesafe ~${distanceKm.toFixed(1)} km (demo bölge merkezi).`
        : 'Mesafe hesaplanamadı (koordinat eksik).',
      'Öneri, karar koordinatördedir; otomatik fiziksel sevk yok.',
    ];
    return {
      ...candidate,
      rank: 0,
      distanceKm,
      available,
      deterministicNote: noteParts.join(' '),
      diagnostics,
    };
  });

  scored.sort((a, b) => {
    if (a.available !== b.available) {
      return a.available ? -1 : 1;
    }
    if (a.distanceKm === null && b.distanceKm === null) {
      return a.teamName.localeCompare(b.teamName);
    }
    if (a.distanceKm === null) {
      return 1;
    }
    if (b.distanceKm === null) {
      return -1;
    }
    return a.distanceKm - b.distanceKm;
  });

  return scored.map((row, index) => ({ ...row, rank: index + 1 }));
}
