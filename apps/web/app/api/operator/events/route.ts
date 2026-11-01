import { NextRequest, NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../lib/config';
import { getSessionToken } from '../../../../lib/session';

export async function GET(request: NextRequest) {
  const afterRaw = request.nextUrl.searchParams.get('after') ?? '0';
  if (!/^\d+$/.test(afterRaw)) {
    return NextResponse.json(
      { code: 'INVALID_AFTER', message: 'after must be a non-negative integer' },
      { status: 400 }
    );
  }
  if (isE2eMock()) {
    const { mockEventsPoll } = await import('../../../../lib/e2e-mock-cases');
    return mockEventsPoll(afterRaw);
  }
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const res = await fetch(
    `${apiBaseUrl()}/v1/operator/events?after=${encodeURIComponent(afterRaw)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
