import { proxyOperatorJson } from '../../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  return proxyOperatorJson('/v1/operator/broadcasts/regions/countries');
}
