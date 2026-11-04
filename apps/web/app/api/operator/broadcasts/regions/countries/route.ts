import { proxyOperatorJson } from '../../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyOperatorJson('/v1/operator/broadcasts/regions/countries');
}
