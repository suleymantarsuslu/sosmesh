import { forwardOperatorJson } from '../../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  return forwardOperatorJson(request, 'PATCH', `/v1/operator/tasks/${taskId}/complete`);
}
