import { NextResponse } from 'next/server';

import { apiBaseUrl } from '../../../../../lib/config';
import { getSessionToken } from '../../../../../lib/session';

export const dynamic = 'force-dynamic';

const FALLBACK = {
  enabled: false,
  circuitState: 'open',
  budgetUsedToday: 0,
  budgetTotalLimit: 150,
  budgetDailyLimit: 30,
  lastAnalysisAt: null,
  queueDepth: 0,
  modelsAvailable: { spark: false, asr: false, sam: false },
};

export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const res = await fetch(`${apiBaseUrl()}/v1/operator/ai/status`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json(FALLBACK, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(FALLBACK, { status: 503 });
  }
}
