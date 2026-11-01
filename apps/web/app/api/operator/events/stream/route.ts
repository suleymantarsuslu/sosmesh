import { NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../../lib/config';
import { getSessionToken } from '../../../../../lib/session';

export async function GET() {
  if (isE2eMock()) {
    const { mockSseResponse } = await import('../../../../../lib/e2e-mock-cases');
    return mockSseResponse();
  }
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const upstream = await fetch(`${apiBaseUrl()}/v1/operator/events?after=0`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    cache: 'no-store',
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ code: 'UPSTREAM_ERROR' }, { status: upstream.status || 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
