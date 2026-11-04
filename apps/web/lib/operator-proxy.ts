import { NextResponse } from 'next/server';

import { apiBaseUrl } from './config';
import { fetchWithSession, getSessionToken } from './session';

/** Forwards a JSON write from the browser to the API with the session Bearer token. */
export async function forwardOperatorJson(
  request: Request,
  method: 'POST' | 'PATCH',
  path: string
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON' }, { status: 400 });
  }
  try {
    const res = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ code: 'UPSTREAM_UNAVAILABLE' }, { status: 502 });
  }
}

/** Authenticated passthrough for the operator API; always answers JSON, even when upstream does not. */
export async function proxyOperatorJson(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<NextResponse> {
  try {
    const res = await fetchWithSession(path, {
      method: init?.method ?? 'GET',
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ code: 'UPSTREAM_UNAVAILABLE' }, { status: 502 });
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
