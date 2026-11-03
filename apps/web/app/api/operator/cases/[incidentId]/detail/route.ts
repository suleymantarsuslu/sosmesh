import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../../../lib/config';
import { LOCALE_COOKIE_NAME } from '../../../../../../lib/i18n/operator-messages';
import { getSessionToken } from '../../../../../../lib/session';

type Params = { params: Promise<{ incidentId: string }> };

/** Operator UI language: explicit ?locale=, else the locale cookie set by the preferences provider. */
async function resolveLocale(request: Request): Promise<'tr' | 'en' | null> {
  const fromQuery = new URL(request.url).searchParams.get('locale');
  const value = fromQuery ?? (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  return value === 'tr' || value === 'en' ? value : null;
}

export async function GET(request: Request, { params }: Params) {
  const { incidentId } = await params;
  const token = await getSessionToken();
  if (!token && !isE2eMock()) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (isE2eMock()) {
    const { mockCaseDetailFullResponse } = await import('../../../../../../lib/e2e-mock-cases');
    return mockCaseDetailFullResponse(incidentId);
  }
  const locale = await resolveLocale(request);
  const query = locale ? `?locale=${locale}` : '';
  const res = await fetch(`${apiBaseUrl()}/v1/operator/cases/${incidentId}/detail${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
