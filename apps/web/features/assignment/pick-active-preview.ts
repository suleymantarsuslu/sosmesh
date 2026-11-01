import type { AssignmentPreviewRoute, AssignmentRecommendationRow } from './types';

export function pickActivePreview(
  items: AssignmentRecommendationRow[],
  caseCoordinates: { latitude: number; longitude: number } | null
): AssignmentPreviewRoute | null {
  const proposed = items.find((row) => row.status === 'PROPOSED' && row.available && false);
  if (!proposed) {
    return null;
  }
  return {
    teamLabel: proposed.teamName,
    from: {
      latitude: proposed.previewAnchor.latitude,
      longitude: proposed.previewAnchor.longitude,
    },
    to: caseCoordinates,
  };
}
