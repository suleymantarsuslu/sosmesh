import { CaseDetailClient } from '../../../../../../features/cases/CaseDetailClient';

type Params = { params: { incidentId: string } };

export default function OperatorCaseDetailPage({ params }: Params) {
  return <CaseDetailClient incidentId={params.incidentId} />;
}
