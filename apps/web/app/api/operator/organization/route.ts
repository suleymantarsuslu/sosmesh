import { NextResponse } from 'next/server';

import { fetchWithSession } from '../../../../lib/session';

export async function GET() {
  const res = await fetchWithSession('/v1/operator/organization/context');
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
