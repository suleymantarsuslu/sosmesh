import { proxyOperatorJson, readJsonBody } from '../../../../../../lib/operator-proxy';

type Params = { params: Promise<{ recommendationId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { recommendationId } = await params;
  const body = (await readJsonBody(request)) as { rating?: unknown; note?: unknown };
  const payload: { rating?: unknown; note?: string } = { rating: body.rating };
  if (typeof body.note === 'string' && body.note.trim()) {
    payload.note = body.note.trim().slice(0, 1000);
  }
  return proxyOperatorJson(
    `/v1/operator/recommendations/${encodeURIComponent(recommendationId)}/feedback`,
    { method: 'POST', body: payload }
  );
}
