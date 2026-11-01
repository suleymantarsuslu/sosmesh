import { NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../../../lib/config';
import { getSessionToken } from '../../../../../../lib/session';

type Params = { params: Promise<{ incidentId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { incidentId } = await params;
  const token = await getSessionToken();
  if (!token && !isE2eMock()) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (isE2eMock()) {
    const { mockCaseDetailFullResponse } = await import('../../../../../../lib/e2e-mock-cases');
    return mockCaseDetailFullResponse(incidentId);
  }
  const res = await fetch(`${apiBaseUrl()}/v1/operator/cases/${incidentId}/detail`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
