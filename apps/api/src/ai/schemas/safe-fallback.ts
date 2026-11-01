import type { SosAiOutput } from './sos-ai-output.schema';

/**
 * Deterministic operator-safe suggestion when model output fails schema validation
 * or the vendor is unavailable. Does not invent counts, places, injuries, or needs.
 */
export function buildSafeFallbackSosAiOutput(params: {
  language: string;
  reason: string;
}): SosAiOutput {
  return {
    categories: ['general'],
    persons_estimate: null,
    injuries_reported: [],
    needs: [],
    urgency_suggestion: 'unknown',
    uncertainty: true,
    quoted_evidence: [],
    location_unknown: true,
    language: params.language,
    requires_human_review: true,
    confidence: 'low',
  };
}

export function isSchemaOrParseFailure(reason: string): boolean {
  return (
    reason === 'invalid_model_json' ||
    reason === 'empty_model_content' ||
    reason === 'response_truncated' ||
    reason.startsWith('forbidden field:') ||
    reason === 'requires_human_review must be true' ||
    reason === 'output must be a JSON object' ||
    reason.endsWith(' invalid') ||
    reason.includes(' must be ')
  );
}
