import { NextResponse } from 'next/server';

import { apiBaseUrl } from '../../../../../../lib/config';
import { getSessionToken } from '../../../../../../lib/session';

export const dynamic = 'force-dynamic';

/** Proxies GET /v1/operator/cases/:id/attachments (transcript text, spark vision summary). */
export async function GET(
  _request: Request,
  props: { params: Promise<{ incidentId: string }> }
) {
  const params = await props.params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const res = await fetch(`${apiBaseUrl()}/v1/operator/cases/${params.incidentId}/attachments`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 503 });
  }
}
