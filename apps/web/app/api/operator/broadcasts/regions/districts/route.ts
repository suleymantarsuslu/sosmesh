import { proxyOperatorJson } from '../../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provinceOsmId = searchParams.get('provinceOsmId');
  const query = provinceOsmId ? `?provinceOsmId=${encodeURIComponent(provinceOsmId)}` : '';
  return proxyOperatorJson(`/v1/operator/broadcasts/regions/districts${query}`);
}
