import { proxyOperatorJson } from '../../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const districtOsmId = searchParams.get('districtOsmId');
  const query = districtOsmId ? `?districtOsmId=${encodeURIComponent(districtOsmId)}` : '';
  return proxyOperatorJson(`/v1/operator/broadcasts/regions/neighborhoods${query}`);
}
