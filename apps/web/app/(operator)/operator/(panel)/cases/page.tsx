import { CasesView } from '../../../../../features/case-list/CasesView';
import type { OperatorCaseRow } from '../../../../../features/case-list/types';
import { fetchWithSession } from '../../../../../lib/session';

export default async function OperatorCasesPage({
  searchParams,
}: {
  searchParams?: { seedCount?: string };
}) {
  const query = new URLSearchParams({ limit: '100' });
  if (searchParams?.seedCount) {
    query.set('seedCount', searchParams.seedCount);
  }
  const res = await fetchWithSession(`/v1/operator/cases?${query.toString()}`);
  let items: OperatorCaseRow[] = [];
  if (res.ok) {
    const body = (await res.json()) as { items: OperatorCaseRow[] };
    items = body.items ?? [];
  }
  return <CasesView initialCases={items} />;
}
