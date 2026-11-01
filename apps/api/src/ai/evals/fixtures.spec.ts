import { validateSosAiOutput } from '../schemas/sos-ai-output.schema';
import { EVAL_FIXTURES } from './fixtures';

describe('AI eval fixtures', () => {
  it('includes at least 30 TR/EN fixtures with schema-valid mock outputs', () => {
    expect(EVAL_FIXTURES.length).toBeGreaterThanOrEqual(30);
    const trCount = EVAL_FIXTURES.filter((fixture) => fixture.locale === 'tr').length;
    const enCount = EVAL_FIXTURES.filter((fixture) => fixture.locale === 'en').length;
    expect(trCount).toBeGreaterThanOrEqual(15);
    expect(enCount).toBeGreaterThanOrEqual(15);

    for (const fixture of EVAL_FIXTURES) {
      const validated = validateSosAiOutput(fixture.output);
      expect(validated.ok).toBe(true);
      if (validated.ok) {
        expect(validated.value.requires_human_review).toBe(true);
      }
    }
  });
});
