import { NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../../../lib/config';
import { getSessionToken } from '../../../../../../lib/session';

type Params = { params: { incidentId: string } };

export async function POST(_request: Request, { params }: Params) {
  const token = getSessionToken();
  if (!token && !isE2eMock()) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (isE2eMock()) {
    const { mockCaseSeenResponse } = await import('../../../../../../lib/e2e-mock-cases');
    return mockCaseSeenResponse(params.incidentId);
  }
  const res = await fetch(`${apiBaseUrl()}/v1/operator/cases/${params.incidentId}/seen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
