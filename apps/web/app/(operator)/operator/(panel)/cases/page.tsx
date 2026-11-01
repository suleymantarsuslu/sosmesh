import { CasesView } from '../../../../../features/case-list/CasesView';
import type { OperatorCaseRow } from '../../../../../features/case-list/types';
import { fetchWithSession } from '../../../../../lib/session';

export default async function OperatorCasesPage({
  searchParams,
}: {
  searchParams?: Promise<{ seedCount?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = new URLSearchParams({ limit: '100' });
  if (resolvedSearchParams?.seedCount) {
    query.set('seedCount', resolvedSearchParams.seedCount);
  }
  const res = await fetchWithSession(`/v1/operator/cases?${query.toString()}`);
  let items: OperatorCaseRow[] = [];
  if (res.ok) {
    const body = (await res.json()) as { items: OperatorCaseRow[] };
    items = body.items ?? [];
  }
  return <CasesView initialCases={items} />;
}
