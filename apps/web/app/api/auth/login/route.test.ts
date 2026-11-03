import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from './route';

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001');
    vi.stubEnv('JWT_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('forwards X-Forwarded-For header to API for rate limiting', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: '1', email: 'test@example.com', role: 'OPERATOR' },
        token: 'test-token',
      }),
    });
    global.fetch = mockFetch;

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.0.2.1, 198.51.100.1',
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    });

    await POST(request);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Forwarded-For': '192.0.2.1, 198.51.100.1',
        }),
      }),
    );
  });

  it('does not add X-Forwarded-For header when not present in request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: '1', email: 'test@example.com', role: 'OPERATOR' },
        token: 'test-token',
      }),
    });
    global.fetch = mockFetch;

    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    });

    await POST(request);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.not.objectContaining({
          'X-Forwarded-For': expect.anything(),
        }),
      }),
    );
  });
});
