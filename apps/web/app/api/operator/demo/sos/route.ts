import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/v1/operator/demo/sos`, {
      method: 'POST',
      headers: {
        Cookie: '',
      },
      body: formData,
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Demo SOS submission failed' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 503 });
  }
}
