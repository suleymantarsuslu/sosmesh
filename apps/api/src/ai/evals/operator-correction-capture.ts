import type { MetadataSnapshot } from '../../operator/metadata-correction.util';
import type { SosAiOutput } from '../schemas/sos-ai-output.schema';

export type OperatorCorrectionCapture = {
  incidentId: string;
  aiSuggestion: SosAiOutput;
  operatorAfter: MetadataSnapshot;
  correctedFields: string[];
};

export function captureOperatorCorrectionDelta(params: {
  incidentId: string;
  aiSuggestion: SosAiOutput;
  operatorAfter: MetadataSnapshot;
}): OperatorCorrectionCapture {
  const correctedFields: string[] = [];

  if (
    params.aiSuggestion.persons_estimate !== null &&
    params.operatorAfter.personCount !== null &&
    params.aiSuggestion.persons_estimate !== params.operatorAfter.personCount
  ) {
    correctedFields.push('personCount');
  }

  if (
    params.aiSuggestion.location_unknown === false &&
    params.operatorAfter.locationStatus === 'UNKNOWN'
  ) {
    correctedFields.push('locationStatus');
  }

  return {
    incidentId: params.incidentId,
    aiSuggestion: params.aiSuggestion,
    operatorAfter: params.operatorAfter,
    correctedFields,
  };
}
