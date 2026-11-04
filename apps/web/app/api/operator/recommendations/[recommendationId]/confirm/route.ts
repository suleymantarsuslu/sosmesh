import { proxyOperatorJson, readJsonBody } from '../../../../../../lib/operator-proxy';

type Params = { params: Promise<{ recommendationId: string }> };

/** Body: { teamId?: string; assigneeId?: string }. AI only suggests; this is the explicit coordinator confirmation. */
export async function POST(request: Request, { params }: Params) {
  const { recommendationId } = await params;
  const body = (await readJsonBody(request)) as { teamId?: unknown; assigneeId?: unknown };
  const payload: { teamId?: string; assigneeId?: string } = {};
  if (typeof body.teamId === 'string' && body.teamId.trim()) {
    payload.teamId = body.teamId.trim();
  }
  if (typeof body.assigneeId === 'string' && body.assigneeId.trim()) {
    payload.assigneeId = body.assigneeId.trim();
  }
  return proxyOperatorJson(
    `/v1/operator/recommendations/${encodeURIComponent(recommendationId)}/confirm`,
    { method: 'POST', body: payload }
  );
}
