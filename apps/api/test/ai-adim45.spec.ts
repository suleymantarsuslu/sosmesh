import { validateSosAiOutput } from '../src/ai/schemas/sos-ai-output.schema';
import {
  buildSafeFallbackSosAiOutput,
  isSchemaOrParseFailure,
} from '../src/ai/schemas/safe-fallback';
import { deidentifySosPlaintextForPrompt } from '../src/ai/deidentify-plaintext';
import { IncidentTokenBudgetGuard } from '../src/ai/ai-guards';
import { getAiRunMetrics, resetAiRunMetricsForTests } from '../src/ai/ai-metrics';
import { captureOperatorCorrectionDelta } from '../src/ai/evals/operator-correction-capture';
import { EVAL_FIXTURES, EVAL_FIXTURE_COUNT } from '../src/ai/evals/fixtures';
import { runMockMetaEval } from '../src/ai/evals/eval-runner';
import { LocationStatus } from '@prisma/client';

describe('ADIM 45 Meta AI eval and cost guards', () => {
  it('keeps 100+ synthetic fixtures without forbidden decision fields', () => {
    expect(EVAL_FIXTURE_COUNT).toBeGreaterThanOrEqual(100);
    for (const fixture of EVAL_FIXTURES) {
      const validated = validateSosAiOutput(fixture.output);
      expect(validated.ok).toBe(true);
      expect(JSON.stringify(fixture.output)).not.toMatch(
        /team_assignment|triage_decision|treatment_plan|rescue_plan/i
      );
    }
  });

  it('safe fallback never fabricates unknown counts or places', () => {
    const fallback = buildSafeFallbackSosAiOutput({ language: 'tr', reason: 'invalid_model_json' });
    expect(fallback.persons_estimate).toBeNull();
    expect(fallback.location_unknown).toBe(true);
    expect(fallback.urgency_suggestion).toBe('unknown');
    expect(fallback.quoted_evidence).toEqual([]);
    expect(fallback.uncertainty).toBe(true);
  });

  it('flags schema parse failures for fallback path', () => {
    expect(isSchemaOrParseFailure('invalid_model_json')).toBe(true);
    expect(isSchemaOrParseFailure('circuit_open')).toBe(false);
  });

  it('rejects schema outputs with medical triage or treatment plans', () => {
    const rejected = validateSosAiOutput({
      categories: ['medical'],
      persons_estimate: 1,
      injuries_reported: [],
      needs: ['medical'],
      urgency_suggestion: 'high',
      uncertainty: true,
      quoted_evidence: [],
      location_unknown: true,
      language: 'en',
      requires_human_review: true,
      treatment_plan: 'give aspirin',
    });
    expect(rejected.ok).toBe(false);
  });

  it('de-identifies email, phone, and coordinate patterns in prompts', () => {
    const syntheticLat = '12.3456';
    const syntheticLon = '54.3210';
    const coordPair = `${syntheticLat},${syntheticLon}`;
    const redacted = deidentifySosPlaintextForPrompt(
      `help me at ${coordPair} call +90 555 123 45 67 email victim@example.com`
    );
    expect(redacted).toContain('[redacted-email]');
    expect(redacted).toContain('[redacted-phone]');
    expect(redacted).toContain('[redacted-coordinates]');
    expect(redacted).not.toContain('victim@example.com');
    expect(redacted).not.toContain(syntheticLat);
    expect(redacted).not.toContain('555 123');
  });

  it('enforces per-incident token budget guard', () => {
    const guard = new IncidentTokenBudgetGuard(3000);
    expect(guard.tryConsume('inc-1', 2000)).toBe(true);
    expect(guard.tryConsume('inc-1', 2000)).toBe(false);
    expect(guard.tryConsume('inc-2', 2000)).toBe(true);
  });

  it('records monitoring metrics for skips and spend', () => {
    resetAiRunMetricsForTests();
    const metrics = getAiRunMetrics();
    metrics.recordSkip('skippedCostCap');
    metrics.recordCostUsd(0.002);
    metrics.recordIncidentTokens(2048);
    const snapshot = metrics.getSnapshot();
    expect(snapshot.skippedCostCap).toBe(1);
    expect(snapshot.estimatedUsdCharged).toBeCloseTo(0.002);
    expect(snapshot.incidentTokensEstimated).toBe(2048);
  });

  it('captures operator correction delta against AI suggestion', () => {
    const capture = captureOperatorCorrectionDelta({
      incidentId: 'inc-capture-1',
      aiSuggestion: {
        categories: ['earthquake'],
        persons_estimate: 2,
        injuries_reported: [],
        needs: ['rescue'],
        urgency_suggestion: 'high',
        uncertainty: false,
        quoted_evidence: ['2 kişi'],
        location_unknown: false,
        language: 'tr',
        requires_human_review: true,
      },
      operatorAfter: {
        personCount: 3,
        locationStatus: LocationStatus.UNKNOWN,
        latitude: null,
        longitude: null,
      },
    });
    expect(capture.correctedFields).toContain('personCount');
    expect(capture.correctedFields).toContain('locationStatus');
  });

  it('mock eval report states real model accuracy NOT_TESTED', async () => {
    const report = await runMockMetaEval(EVAL_FIXTURES);
    expect(report.real_model_accuracy).toBe('NOT_TESTED');
  });
});
