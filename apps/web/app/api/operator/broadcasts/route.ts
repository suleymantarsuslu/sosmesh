import { forwardOperatorJson } from '../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return forwardOperatorJson(request, 'POST', '/v1/operator/broadcasts');
}
