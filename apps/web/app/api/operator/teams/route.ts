import { forwardOperatorJson } from '../../../../lib/operator-proxy';

export async function POST(request: Request) {
  return forwardOperatorJson(request, 'POST', '/v1/operator/teams');
}
