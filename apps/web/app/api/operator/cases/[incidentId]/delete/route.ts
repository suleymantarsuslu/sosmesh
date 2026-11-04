import { forwardOperatorJson } from '../../../../../../lib/operator-proxy';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  const { incidentId } = await params;
  return forwardOperatorJson(request, 'POST', `/v1/operator/cases/${incidentId}/delete`);
}
