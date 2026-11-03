import { NextResponse } from 'next/server';

import { apiBaseUrl } from '../../../../../../lib/config';
import { getSessionToken } from '../../../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const res = await fetch(`${apiBaseUrl()}/v1/operator/attachments/${params.id}/image`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Image not found' }, { status: res.status });
    }

    const arrayBuffer = await res.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'image/jpeg',
        'Content-Length': res.headers.get('Content-Length') || '',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 503 });
  }
}
