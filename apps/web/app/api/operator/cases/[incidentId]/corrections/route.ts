import { NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../../../lib/config';
import { getSessionToken } from '../../../../../../lib/session';

type Params = { params: { incidentId: string } };

export async function POST(request: Request, { params }: Params) {
  const token = getSessionToken();
  const body = await request.json();
  if (!token && !isE2eMock()) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (isE2eMock()) {
    const { mockCaseCorrectionResponse } = await import('../../../../../../lib/e2e-mock-cases');
    return mockCaseCorrectionResponse(params.incidentId, body);
  }
  const res = await fetch(`${apiBaseUrl()}/v1/operator/cases/${params.incidentId}/corrections`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
