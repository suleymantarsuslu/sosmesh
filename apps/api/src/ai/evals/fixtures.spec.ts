import { validateSosAiOutput } from '../schemas/sos-ai-output.schema';
import { EVAL_FIXTURES } from './fixtures';

describe('AI eval fixtures', () => {
  it('includes at least 100 TR/EN fixtures with schema-valid mock outputs', () => {
    expect(EVAL_FIXTURES.length).toBeGreaterThanOrEqual(100);
    const trCount = EVAL_FIXTURES.filter((fixture) => fixture.locale === 'tr').length;
    const enCount = EVAL_FIXTURES.filter((fixture) => fixture.locale === 'en').length;
    expect(trCount).toBeGreaterThanOrEqual(50);
    expect(enCount).toBeGreaterThanOrEqual(50);

    for (const fixture of EVAL_FIXTURES) {
      const validated = validateSosAiOutput(fixture.output);
      expect(validated.ok).toBe(true);
      if (validated.ok) {
        expect(validated.value.requires_human_review).toBe(true);
      }
    }
  });

  it('tags typo, panic, contradiction, unknown, and injection scenarios', () => {
    const tagSet = new Set(EVAL_FIXTURES.flatMap((fixture) => fixture.tags ?? []));
    expect(tagSet.has('typo')).toBe(true);
    expect(tagSet.has('panic')).toBe(true);
    expect(tagSet.has('contradiction')).toBe(true);
    expect(tagSet.has('unknown-info')).toBe(true);
    expect(tagSet.has('injection')).toBe(true);
  });
});
