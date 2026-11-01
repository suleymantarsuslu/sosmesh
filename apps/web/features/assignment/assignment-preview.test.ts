import { describe, expect, it } from 'vitest';

import type { AssignmentRecommendationRow } from './types';

function pickActivePreview(
  items: AssignmentRecommendationRow[],
  caseCoordinates: { latitude: number; longitude: number } | null
) {
  const proposed = items.find((row) => row.status === 'PROPOSED' && row.available);
  if (!proposed) {
    return null;
  }
  return {
    teamLabel: proposed.teamName,
    from: proposed.previewAnchor,
    to: caseCoordinates,
  };
}

describe('assignment preview helpers', () => {
  it('selects first available proposed row for map preview', () => {
    const items: AssignmentRecommendationRow[] = [
      {
        id: '1',
        incidentId: 'i',
        teamId: 't',
        teamName: 'Alpha',
        resourceId: null,
        resourceName: null,
        rank: 1,
        distanceKm: 2,
        available: false,
        status: 'PROPOSED',
        deterministicNote: 'busy',
        aiRationale: null,
        missingInfo: [],
        dataFreshness: {
          sosReceivedAt: '2026-11-01T00:00:00.000Z',
          ageMinutes: 1,
          stale: false,
          staleThresholdMinutes: 120,
        },
        previewAnchor: { latitude: 39.9, longitude: 32.8, synthetic: true },
        workTaskId: null,
        disclaimer: 'disclaimer',
      },
      {
        id: '2',
        incidentId: 'i',
        teamId: 't2',
        teamName: 'Bravo',
        resourceId: 'r',
        resourceName: 'Unit',
        rank: 2,
        distanceKm: 1,
        available: true,
        status: 'PROPOSED',
        deterministicNote: 'ok',
        aiRationale: null,
        missingInfo: ['GPS'],
        dataFreshness: {
          sosReceivedAt: '2026-11-01T00:00:00.000Z',
          ageMinutes: 1,
          stale: false,
          staleThresholdMinutes: 120,
        },
        previewAnchor: { latitude: 39.91, longitude: 32.81, synthetic: true },
        workTaskId: null,
        disclaimer: 'disclaimer',
      },
    ];
    const preview = pickActivePreview(items, { latitude: 39.925, longitude: 32.836 });
    expect(preview?.teamLabel).toBe('Bravo');
    expect(preview?.to?.latitude).toBe(39.925);
  });
});
