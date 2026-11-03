import { type NextRequest, NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../../lib/config';
import { getSessionToken } from '../../../../../lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (isE2eMock()) {
    const { mockSseResponse } = await import('../../../../../lib/e2e-mock-cases');
    return mockSseResponse();
  }
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const after = request.nextUrl.searchParams.get('after') ?? '0';
  const lastEventId = request.headers.get('Last-Event-ID');
  const afterParam = lastEventId && /^\d+$/.test(lastEventId) ? lastEventId : after;

  const upstream = await fetch(`${apiBaseUrl()}/v1/operator/events?after=${encodeURIComponent(afterParam)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
      ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
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
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
