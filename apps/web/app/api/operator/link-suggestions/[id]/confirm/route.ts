import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/v1/operator/link-suggestions/${params.id}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: '',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to confirm link' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 503 });
  }
}
