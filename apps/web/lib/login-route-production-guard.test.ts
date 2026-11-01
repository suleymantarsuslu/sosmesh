import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('operator login route production guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('rejects mock e2e-admin credentials when OPERATOR_E2E_MOCK is ignored in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OPERATOR_E2E_MOCK', '1');
    vi.stubEnv('JWT_SECRET', 'test-operator-jwt-signing-key-16');
    vi.stubEnv('OPERATOR_E2E_PASSWORD', 'e2e-test-password-16chars');

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ code: 'INVALID_CREDENTIALS' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('../app/api/auth/login/route');
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'e2e-admin@sosmesh.example',
        password: 'e2e-test-password-16chars',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalled();
  });
});
