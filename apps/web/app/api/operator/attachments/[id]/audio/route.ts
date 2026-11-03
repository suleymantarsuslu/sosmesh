import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/v1/operator/attachments/${params.id}/audio`, {
      cache: 'no-store',
      headers: {
        Cookie: '',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Audio not found' }, { status: res.status });
    }

    const arrayBuffer = await res.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'audio/wav',
        'Content-Length': res.headers.get('Content-Length') || '',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 503 });
  }
}
