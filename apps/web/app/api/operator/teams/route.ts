import { forwardOperatorJson, proxyOperatorJson } from '../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  return proxyOperatorJson('/v1/operator/teams');
}

export async function POST(request: Request) {
  return forwardOperatorJson(request, 'POST', '/v1/operator/teams');
}
