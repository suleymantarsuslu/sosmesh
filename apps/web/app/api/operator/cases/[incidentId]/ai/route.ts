import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ incidentId: string }> }
) {
  const params = await props.params;
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/v1/operator/cases/${params.incidentId}/ai`, {
      cache: 'no-store',
      headers: {
        Cookie: '',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          triage: null,
          transcript: null,
          sparkVision: null,
          samVision: null,
          linkSuggestions: [],
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        triage: null,
        transcript: null,
        sparkVision: null,
        samVision: null,
        linkSuggestions: [],
      },
      { status: 503 }
    );
  }
}
