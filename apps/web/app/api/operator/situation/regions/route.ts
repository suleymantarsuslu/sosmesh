import type { NextRequest } from 'next/server';

import { proxyOperatorJson } from '../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const windowHours = request.nextUrl.searchParams.get('windowHours');
  const minUrgency = request.nextUrl.searchParams.get('minUrgency');
  const query = new URLSearchParams();
  if (windowHours) {
    query.set('windowHours', windowHours);
  }
  if (minUrgency) {
    query.set('minUrgency', minUrgency);
  }
  const qs = query.toString();
  return proxyOperatorJson(`/v1/operator/situation/regions${qs ? `?${qs}` : ''}`);
}
