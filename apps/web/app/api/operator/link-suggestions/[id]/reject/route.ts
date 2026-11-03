import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/v1/operator/link-suggestions/${params.id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: '',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to reject link' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 503 });
  }
}
