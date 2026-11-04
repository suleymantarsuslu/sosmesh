import { proxyOperatorJson } from '../../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countryOsmId = searchParams.get('countryOsmId');
  const query = countryOsmId ? `?countryOsmId=${encodeURIComponent(countryOsmId)}` : '';
  return proxyOperatorJson(`/v1/operator/broadcasts/regions/provinces${query}`);
}
