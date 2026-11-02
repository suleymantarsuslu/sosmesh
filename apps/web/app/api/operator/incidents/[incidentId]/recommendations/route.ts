import { NextResponse } from 'next/server';

import { fetchWithSession } from '../../../../../../lib/session';

type Params = { params: Promise<{ incidentId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { incidentId } = await params;
  const res = await fetchWithSession(
    `/v1/operator/incidents/${incidentId}/recommendations/plan`,
    { method: 'POST' }
  );
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function GET(_request: Request, { params }: Params) {
  const { incidentId } = await params;
  const res = await fetchWithSession(`/v1/operator/incidents/${incidentId}/recommendations`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
