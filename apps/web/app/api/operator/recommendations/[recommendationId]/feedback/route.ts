import { NextRequest, NextResponse } from 'next/server';

import { fetchWithSession } from '../../../../../../lib/session';

type Params = { params: Promise<{ recommendationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { recommendationId } = await params;
  const body = await request.json();
  const res = await fetchWithSession(
    `/v1/operator/recommendations/${recommendationId}/feedback`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
