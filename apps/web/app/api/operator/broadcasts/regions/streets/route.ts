import { proxyOperatorJson } from '../../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const neighborhoodName = searchParams.get('neighborhoodName');
  const districtName = searchParams.get('districtName');
  const provinceName = searchParams.get('provinceName');
  const parts: string[] = [];
  if (neighborhoodName) {
    parts.push(`neighborhoodName=${encodeURIComponent(neighborhoodName)}`);
  }
  if (districtName) {
    parts.push(`districtName=${encodeURIComponent(districtName)}`);
  }
  if (provinceName) {
    parts.push(`provinceName=${encodeURIComponent(provinceName)}`);
  }
  const query = parts.length > 0 ? `?${parts.join('&')}` : '';
  return proxyOperatorJson(`/v1/operator/broadcasts/regions/streets${query}`);
}
