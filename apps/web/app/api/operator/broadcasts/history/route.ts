import { proxyOperatorJson } from '../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const limit = new URL(request.url).searchParams.get('limit');
  const query = limit && /^\d{1,3}$/.test(limit) ? `?limit=${limit}` : '';
  return proxyOperatorJson(`/v1/operator/broadcasts/history${query}`);
}
