import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  props: { params: Promise<{ incidentId: string }> }
) {
  const params = await props.params;
  try {
    const body = await request.json();
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/v1/operator/cases/${params.incidentId}/ai-override`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: '',
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
