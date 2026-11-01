/**
 * ADIM 20 — structured AI suggestion schema (operator-facing fields only).
 * Output is always a non-binding suggestion; never an autonomous decision.
 */

export type UrgencySuggestion = 'low' | 'medium' | 'high' | 'unknown';

export type SosAiOutput = {
  categories: string[];
  persons_estimate: number | null;
  injuries_reported: string[];
  needs: string[];
  urgency_suggestion: UrgencySuggestion;
  uncertainty: boolean;
  quoted_evidence: string[];
  location_unknown: boolean;
  language: string;
  requires_human_review: true;
  confidence?: 'low' | 'medium' | 'high';
};

const URGENCY_VALUES: UrgencySuggestion[] = ['low', 'medium', 'high', 'unknown'];

const FORBIDDEN_KEYS = new Set([
  'team_assignment',
  'assigned_team',
  'team_id',
  'rescue_plan',
  'triage_decision',
  'treatment_plan',
  'dispatch_team',
]);

export type SosAiValidationResult =
  | { ok: true; value: SosAiOutput }
  | { ok: false; reason: string };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateSosAiOutput(raw: unknown): SosAiValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'output must be a JSON object' };
  }

  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_KEYS.has(key)) {
      return { ok: false, reason: `forbidden field: ${key}` };
    }
  }

  if (record.requires_human_review !== true) {
    return { ok: false, reason: 'requires_human_review must be true' };
  }

  if (!isStringArray(record.categories)) {
    return { ok: false, reason: 'categories must be string[]' };
  }

  const persons = record.persons_estimate;
  if (persons !== null && (typeof persons !== 'number' || !Number.isFinite(persons))) {
    return { ok: false, reason: 'persons_estimate must be number or null' };
  }

  if (!isStringArray(record.injuries_reported)) {
    return { ok: false, reason: 'injuries_reported must be string[]' };
  }
  if (!isStringArray(record.needs)) {
    return { ok: false, reason: 'needs must be string[]' };
  }

  if (
    typeof record.urgency_suggestion !== 'string' ||
    !URGENCY_VALUES.includes(record.urgency_suggestion as UrgencySuggestion)
  ) {
    return { ok: false, reason: 'urgency_suggestion invalid' };
  }

  if (typeof record.uncertainty !== 'boolean') {
    return { ok: false, reason: 'uncertainty must be boolean' };
  }
  if (!isStringArray(record.quoted_evidence)) {
    return { ok: false, reason: 'quoted_evidence must be string[]' };
  }
  if (typeof record.location_unknown !== 'boolean') {
    return { ok: false, reason: 'location_unknown must be boolean' };
  }
  if (typeof record.language !== 'string' || record.language.length === 0) {
    return { ok: false, reason: 'language must be non-empty string' };
  }

  let confidence: SosAiOutput['confidence'];
  if (record.confidence !== undefined) {
    if (record.confidence !== 'low' && record.confidence !== 'medium' && record.confidence !== 'high') {
      return { ok: false, reason: 'confidence invalid' };
    }
    confidence = record.confidence;
  }

  return {
    ok: true,
    value: {
      categories: record.categories,
      persons_estimate: persons as number | null,
      injuries_reported: record.injuries_reported,
      needs: record.needs,
      urgency_suggestion: record.urgency_suggestion as UrgencySuggestion,
      uncertainty: record.uncertainty,
      quoted_evidence: record.quoted_evidence,
      location_unknown: record.location_unknown,
      language: record.language,
      requires_human_review: true,
      confidence,
    },
  };
}
