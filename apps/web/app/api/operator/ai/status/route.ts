import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const res = await fetch(`${apiUrl}/v1/operator/ai/status`, {
      cache: 'no-store',
      headers: {
        Cookie: '',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          enabled: false,
          circuitState: 'open',
          budgetUsedToday: 0,
          budgetTotalLimit: 150,
          budgetDailyLimit: 30,
          lastAnalysisAt: null,
          queueDepth: 0,
          modelsAvailable: { spark: false, asr: false, sam: false },
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        enabled: false,
        circuitState: 'open',
        budgetUsedToday: 0,
        budgetTotalLimit: 150,
        budgetDailyLimit: 30,
        lastAnalysisAt: null,
        queueDepth: 0,
        modelsAvailable: { spark: false, asr: false, sam: false },
      },
      { status: 503 }
    );
  }
}
