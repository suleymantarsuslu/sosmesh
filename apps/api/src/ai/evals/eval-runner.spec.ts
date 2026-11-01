import { runMockMetaEval } from './eval-runner';
import { EVAL_FIXTURES, EVAL_FIXTURE_COUNT } from './fixtures';

describe('AI mock eval runner (ADIM 45)', () => {
  it('runs deterministic mock provider eval over 100+ fixtures', async () => {
    expect(EVAL_FIXTURE_COUNT).toBeGreaterThanOrEqual(100);
    const report = await runMockMetaEval(EVAL_FIXTURES);
    expect(report.real_model_accuracy).toBe('NOT_TESTED');
    expect(report.fixture_count).toBeGreaterThanOrEqual(100);
    for (const field of Object.keys(report.field_accuracy)) {
      const stats = report.field_accuracy[field as keyof typeof report.field_accuracy];
      expect(stats.matched).toBe(stats.total);
    }
    expect(report.injection_cases_total).toBeGreaterThan(0);
    expect(report.injection_cases_passed).toBe(report.injection_cases_total);
  });
});
