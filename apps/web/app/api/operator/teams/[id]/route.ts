import { forwardOperatorJson } from '../../../../../lib/operator-proxy';

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return forwardOperatorJson(request, 'PATCH', `/v1/operator/teams/${encodeURIComponent(id)}`);
}
