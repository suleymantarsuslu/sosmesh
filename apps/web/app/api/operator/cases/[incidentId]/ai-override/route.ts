import { NextResponse } from 'next/server';

import { apiBaseUrl } from '../../../../../../lib/config';
import { getSessionToken } from '../../../../../../lib/session';

export async function POST(
  request: Request,
  props: { params: Promise<{ incidentId: string }> }
) {
  const params = await props.params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const res = await fetch(`${apiBaseUrl()}/v1/operator/cases/${params.incidentId}/ai-override`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to save override' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 503 });
  }
}
