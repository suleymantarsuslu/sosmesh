import { afterEach, describe, expect, it, vi } from 'vitest';

describe('map-config production guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('ignores NEXT_PUBLIC_MAP_TEST_MODE in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_MAP_TEST_MODE', '1');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { isMapTestMode, resolveMapStyle } = await import('./map-config');
    expect(isMapTestMode()).toBe(false);
    expect(resolveMapStyle().sources).not.toEqual({});
    expect(warn).toHaveBeenCalled();
  });

  it('uses empty local style when MAP_TEST_MODE is set in non-production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_MAP_TEST_MODE', '1');
    const { resolveMapStyle } = await import('./map-config');
    expect(resolveMapStyle().sources).toEqual({});
  });
});
