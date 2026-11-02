import { LocationStatus } from '@prisma/client';

import {
  buildMatchDiagnostics,
  haversineKm,
  rankResourceMatches,
  type ResourceMatchCandidate,
} from './matching-engine';

describe('matching-engine (ADIM 46)', () => {
  const now = new Date('2026-11-01T12:00:00.000Z');

  it('computes haversine distance deterministically', () => {
    const km = haversineKm(39.92, 32.85, 39.93, 32.86);
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(5);
  });

  it('flags stale case and low GPS accuracy in missing info', () => {
    const diagnostics = buildMatchDiagnostics({
      latitude: 39.92,
      longitude: 32.85,
      accuracyMeters: 5000,
      locationStatus: LocationStatus.GPS,
      receivedAt: new Date(now.getTime() - 3 * 60 * 60_000),
      incidentUpdatedAt: now,
      now,
    });
    expect(diagnostics.dataFreshness.stale).toBe(true);
    expect(diagnostics.missingInfo.some((line) => line.includes('bayat'))).toBe(true);
    expect(diagnostics.missingInfo.some((line) => line.includes('GPS'))).toBe(true);
  });

  it('ranks available teams before unavailable and prefers shorter distance', () => {
    const incident = {
      latitude: 39.925,
      longitude: 32.836,
      accuracyMeters: 100,
      locationStatus: LocationStatus.GPS,
      receivedAt: now,
      incidentUpdatedAt: now,
      now,
    };
    const candidates: ResourceMatchCandidate[] = [
      {
        resourceId: 'r-far-busy',
        resourceName: 'Far busy',
        teamId: 't1',
        teamName: 'Team Far',
        zoneCode: 'SYNTH-RESCUE-B',
        capacity: 1,
        openTaskCount: 5,
        isActive: true,
        isAvailableWindow: true,
      },
      {
        resourceId: 'r-near',
        resourceName: 'Near free',
        teamId: 't2',
        teamName: 'Team Near',
        zoneCode: 'SYNTH-Z1',
        capacity: 2,
        openTaskCount: 0,
        isActive: true,
        isAvailableWindow: true,
      },
    ];
    const ranked = rankResourceMatches({ incident, candidates });
    expect(ranked[0].resourceId).toBe('r-near');
    expect(ranked[0].available).toBe(true);
    expect(ranked[1].available).toBe(false);
  });

  it('returns no distance when coordinates missing', () => {
    const incident = {
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      locationStatus: LocationStatus.UNKNOWN,
      receivedAt: now,
      incidentUpdatedAt: now,
      now,
    };
    const candidates: ResourceMatchCandidate[] = [
      {
        resourceId: 'r1',
        resourceName: 'Unit',
        teamId: 't1',
        teamName: 'Team',
        zoneCode: 'SYNTH-Z1',
        capacity: 1,
        openTaskCount: 0,
        isActive: true,
        isAvailableWindow: true,
      },
    ];
    const ranked = rankResourceMatches({ incident, candidates });
    expect(ranked[0].distanceKm).toBeNull();
    expect(ranked[0].diagnostics.missingInfo.length).toBeGreaterThan(0);
  });
});
