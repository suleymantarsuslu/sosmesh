import { afterEach, describe, expect, it, vi } from 'vitest';

describe('web config guards', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('disables OPERATOR_E2E_MOCK in production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OPERATOR_E2E_MOCK', '1');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { isE2eMock } = await import('./config');
    expect(isE2eMock()).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it('allows OPERATOR_E2E_MOCK outside production for demo flows', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OPERATOR_E2E_MOCK', '1');
    const { isE2eMock } = await import('./config');
    expect(isE2eMock()).toBe(true);
  });
});
