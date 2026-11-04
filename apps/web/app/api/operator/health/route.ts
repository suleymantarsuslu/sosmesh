import { NextResponse } from 'next/server';

import { loadHealthSnapshot } from '../../../../lib/health-snapshot';
import { canAccessOperatorHealthPage } from '../../../../lib/operator-health-access';
import { readSession } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!canAccessOperatorHealthPage(session.role)) {
    return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
  }
  return NextResponse.json(await loadHealthSnapshot());
}
