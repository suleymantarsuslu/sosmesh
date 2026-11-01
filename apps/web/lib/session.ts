import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

import { SESSION_COOKIE, apiBaseUrl, isE2eMock } from './config';

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'OPERATOR' | 'ADMIN' | 'COORDINATOR';
  teamId: string | null;
};

export type SessionPayload = {
  sub: string;
  role: SessionUser['role'];
  teamId?: string;
};

export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE)?.value;
}

export function readSession(): SessionUser | null {
  const token = getSessionToken();
  if (!token) {
    return null;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }
  try {
    const payload = verify(token, secret, { algorithms: ['HS256'] }) as SessionPayload;
    if (isE2eMock() && payload.sub === 'e2e-viewer') {
      return {
        id: payload.sub,
        email: 'e2e-viewer@sosmesh.example',
        displayName: 'E2E Viewer',
        role: payload.role,
        teamId: null,
      };
    }
    if (isE2eMock() && payload.sub === 'e2e-operator') {
      return {
        id: payload.sub,
        email: 'e2e-operator@sosmesh.example',
        displayName: 'E2E Operator',
        role: 'OPERATOR',
        teamId: null,
      };
    }
    return {
      id: payload.sub,
      email: '',
      displayName: '',
      role: payload.role,
      teamId: payload.teamId ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchWithSession(path: string, init?: RequestInit) {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');
  if (isE2eMock()) {
    return mockFetch(path, init);
  }
  return fetch(`${apiBaseUrl()}${path}`, { ...init, headers, cache: 'no-store' });
}

async function mockFetch(path: string, init?: RequestInit): Promise<Response> {
  if (path === '/v1/operator/dashboard/stats' && (!init?.method || init.method === 'GET')) {
    return new Response(
      JSON.stringify({
        newSos: null,
        openOnPanel: null,
        pending: null,
        avgReachSeconds: null,
        hasData: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (path === '/v1/operator/incidents' && (!init?.method || init.method === 'GET')) {
    return new Response(JSON.stringify({ items: [], nextCursor: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (path === '/v1/auth/me' && (!init?.method || init.method === 'GET')) {
    const session = readSession();
    if (!session) {
      return new Response(JSON.stringify({ code: 'UNAUTHORIZED' }), { status: 401 });
    }
    return new Response(JSON.stringify({ user: session }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 404 });
}
