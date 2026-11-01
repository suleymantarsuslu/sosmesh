import { NextRequest, NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../lib/config';
import { getSessionToken } from '../../../../lib/session';

export async function GET(request: NextRequest) {
  const token = getSessionToken();
  if (!token && !isE2eMock()) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (isE2eMock()) {
    const { mockCasesResponse } = await import('../../../../lib/e2e-mock-cases');
    return mockCasesResponse(request.nextUrl.searchParams);
  }
  const query = request.nextUrl.searchParams.toString();
  const res = await fetch(`${apiBaseUrl()}/v1/operator/cases${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
