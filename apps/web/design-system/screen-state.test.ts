import { describe, expect, it } from 'vitest';

import { resolveScreenState } from './ScreenState';

describe('design-system ScreenState', () => {
  it('prefers loading over other states', () => {
    expect(
      resolveScreenState({ loading: true, error: true, hasData: true })
    ).toBe('loading');
  });

  it('returns error when not loading', () => {
    expect(
      resolveScreenState({ loading: false, error: true, hasData: true })
    ).toBe('error');
  });

  it('returns empty when no data', () => {
    expect(
      resolveScreenState({ loading: false, error: false, hasData: false })
    ).toBe('empty');
  });

  it('returns idle when data is present', () => {
    expect(
      resolveScreenState({ loading: false, error: false, hasData: true })
    ).toBe('idle');
  });
});
