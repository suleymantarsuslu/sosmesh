import { proxyOperatorJson } from '../../../../../../lib/operator-proxy';

type Params = { params: Promise<{ recommendationId: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  const { recommendationId } = await params;
  return proxyOperatorJson(
    `/v1/operator/recommendations/${encodeURIComponent(recommendationId)}/reject`,
    { method: 'PATCH' }
  );
}
