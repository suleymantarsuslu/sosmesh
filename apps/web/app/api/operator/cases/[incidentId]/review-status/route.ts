import { NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../../../lib/config';
import { getSessionToken } from '../../../../../../lib/session';

type Params = { params: Promise<{ incidentId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { incidentId } = await params;
  const token = await getSessionToken();
  const body = await request.json();
  if (!token && !isE2eMock()) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (isE2eMock()) {
    const { mockCaseReviewStatusResponse } = await import('../../../../../../lib/e2e-mock-cases');
    return mockCaseReviewStatusResponse(incidentId, body);
  }
  const res = await fetch(`${apiBaseUrl()}/v1/operator/cases/${incidentId}/review-status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
