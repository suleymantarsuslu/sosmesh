import type { SosAiOutput } from '../schemas/sos-ai-output.schema';
import { runMockMetaEval } from './eval-runner';
import { EVAL_FIXTURES, EVAL_FIXTURE_COUNT } from './fixtures';

describe('AI mock eval runner (ADIM 45)', () => {
  it('reports real model accuracy as NOT_TESTED (mock fixtures only)', async () => {
    expect(EVAL_FIXTURE_COUNT).toBeGreaterThanOrEqual(100);
    const report = await runMockMetaEval(EVAL_FIXTURES);
    expect(report.real_model_accuracy).toBe('NOT_TESTED');
    expect(report.provider).toBe('mock-meta-fixture');
    expect(report.fixture_count).toBeGreaterThanOrEqual(100);
  });

  it('rejects fixtures whose golden output fails schema validation', async () => {
    const invalidOutput = {
      categories: ['general'],
      persons_estimate: null,
      injuries_reported: [],
      needs: [],
      urgency_suggestion: 'unknown',
      uncertainty: true,
      quoted_evidence: [],
      location_unknown: true,
      language: 'en',
      requires_human_review: false,
    } as unknown as SosAiOutput;

    await expect(
      runMockMetaEval([
        {
          id: 'schema-invalid-fixture',
          locale: 'en',
          input: 'unique-schema-invalid-input-xyz',
          output: invalidOutput,
        },
      ])
    ).rejects.toThrow(/mock classify failed|invalid schema/);
  });
});
