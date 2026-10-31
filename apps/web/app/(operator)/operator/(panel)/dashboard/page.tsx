import { fetchWithSession } from '../../../../../lib/session';

import { DashboardView } from './DashboardView';

type Stats = {
  newSos: number | null;
  openOnPanel: number | null;
  pending: number | null;
  avgReachSeconds: number | null;
  hasData: boolean;
};

export default async function OperatorDashboardPage() {
  const statsRes = await fetchWithSession('/v1/operator/dashboard/stats');
  const stats = (statsRes.ok ? await statsRes.json() : null) as Stats | null;
  const incidentsRes = await fetchWithSession('/v1/operator/incidents');
  const incidentsBody = incidentsRes.ok
    ? ((await incidentsRes.json()) as { items?: { id: string; state: string; createdAt: string }[] })
    : { items: [] };

  const safeStats: Stats = stats ?? {
    newSos: null,
    openOnPanel: null,
    pending: null,
    avgReachSeconds: null,
    hasData: false,
  };

  return (
    <DashboardView stats={safeStats} incidents={incidentsBody.items ?? []} />
  );
}
