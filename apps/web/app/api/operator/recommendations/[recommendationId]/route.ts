import { NextRequest, NextResponse } from 'next/server';

import { fetchWithSession } from '../../../../../lib/session';

type Params = { params: { recommendationId: string } };

export async function PATCH(_request: NextRequest, { params }: Params) {
  const res = await fetchWithSession(
    `/v1/operator/recommendations/${params.recommendationId}/reject`,
    { method: 'PATCH' }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest, { params }: Params) {
  const body = await request.json();
  const res = await fetchWithSession(
    `/v1/operator/recommendations/${params.recommendationId}/confirm`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
