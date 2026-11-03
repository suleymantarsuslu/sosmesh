/**
 * Link Suggestion View Contract - Operator API response shape
 * Work Package A - AI Foundation
 */

export type DeterministicSignals = {
  distanceMeters: number | null;
  timeDeltaSeconds: number;
  locationProximity: boolean;
  timeProximity: boolean;
  sosTypeMatch: boolean;
  tokenOverlap: number;
};

export type IncidentLinkSuggestionView = {
  id: string;
  incidentAId: string;
  incidentBId: string;
  score: number;
  deterministicSignals: DeterministicSignals;
  aiRationale: string | null;
  status: 'suggested' | 'confirmed' | 'rejected';
  decidedBy: {
    userId: string;
    displayName: string;
  } | null;
  decidedAt: string | null;
  createdAt: string;
};
