export type AssignmentRecommendationRow = {
  id: string;
  incidentId: string;
  teamId: string;
  teamName: string;
  resourceId: string | null;
  resourceName: string | null;
  rank: number;
  distanceKm: number | null;
  available: boolean;
  status: 'PROPOSED' | 'REJECTED' | 'CONFIRMED';
  deterministicNote: string;
  aiRationale: string | null;
  missingInfo: string[];
  dataFreshness: {
    sosReceivedAt: string;
    ageMinutes: number;
    stale: boolean;
    staleThresholdMinutes: number;
  };
  previewAnchor: { latitude: number; longitude: number; synthetic: boolean };
  workTaskId: string | null;
  disclaimer: string;
};

export type AssignmentPreviewRoute = {
  teamLabel: string;
  from: { latitude: number; longitude: number };
  to: { latitude: number; longitude: number } | null;
};
