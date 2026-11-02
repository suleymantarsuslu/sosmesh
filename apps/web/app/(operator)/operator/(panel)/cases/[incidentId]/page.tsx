import { CaseDetailClient } from '../../../../../../features/cases/CaseDetailClient';

type Params = { params: Promise<{ incidentId: string }> };

export default async function OperatorCaseDetailPage({ params }: Params) {
  const { incidentId } = await params;
  return <CaseDetailClient incidentId={incidentId} />;
}
