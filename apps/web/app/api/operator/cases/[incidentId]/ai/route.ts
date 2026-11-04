import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { apiBaseUrl, isE2eMock } from '../../../../../../lib/config';
import { LOCALE_COOKIE_NAME } from '../../../../../../lib/i18n/operator-messages';
import { getSessionToken } from '../../../../../../lib/session';

export const dynamic = 'force-dynamic';

const EMPTY_AI = {
  triage: null,
  transcript: null,
  sparkVision: null,
  samVision: null,
  linkSuggestions: [],
};

/**
 * Proxies GET /v1/operator/cases/:id/ai/bundle (triage, transcript, spark vision, link
 * suggestions in one call). The operator session token is forwarded because the API route
 * sits behind OperatorAuthGuard. Masks are loaded separately from the attachments route.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ incidentId: string }> }
) {
  const params = await props.params;
  if (isE2eMock()) {
    return NextResponse.json(EMPTY_AI);
  }
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const fromQuery = new URL(request.url).searchParams.get('locale');
  const candidate = fromQuery ?? (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  const locale = candidate === 'tr' || candidate === 'en' ? candidate : null;
  const query = locale ? `?locale=${locale}` : '';
  try {
    const res = await fetch(
      `${apiBaseUrl()}/v1/operator/cases/${params.incidentId}/ai/bundle${query}`,
      {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) {
      return NextResponse.json({ ...EMPTY_AI, code: 'AI_UPSTREAM_ERROR' }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ ...EMPTY_AI, code: 'AI_NETWORK_ERROR' }, { status: 503 });
  }
}
