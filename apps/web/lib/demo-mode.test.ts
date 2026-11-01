import { afterEach, describe, expect, it, vi } from 'vitest';

describe('demo mode banner visibility', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('shows banner when OPERATOR_E2E_MOCK is enabled outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OPERATOR_E2E_MOCK', '1');
    const { shouldShowDemoModeBanner } = await import('./demo-mode');
    expect(shouldShowDemoModeBanner()).toBe(true);
  });

  it('hides banner in production even if OPERATOR_E2E_MOCK is set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OPERATOR_E2E_MOCK', '1');
    const { shouldShowDemoModeBanner } = await import('./demo-mode');
    expect(shouldShowDemoModeBanner()).toBe(false);
  });

  it('hides banner when mock flag is off', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OPERATOR_E2E_MOCK', '');
    const { shouldShowDemoModeBanner } = await import('./demo-mode');
    expect(shouldShowDemoModeBanner()).toBe(false);
  });
});
