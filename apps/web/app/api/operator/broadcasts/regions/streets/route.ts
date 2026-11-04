import { proxyOperatorJson } from '../../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const neighborhoodOsmId = searchParams.get('neighborhoodOsmId');
  const query = neighborhoodOsmId ? `?neighborhoodOsmId=${encodeURIComponent(neighborhoodOsmId)}` : '';
  return proxyOperatorJson(`/v1/operator/broadcasts/regions/streets${query}`);
}
