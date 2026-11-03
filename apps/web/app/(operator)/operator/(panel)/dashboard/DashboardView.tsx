'use client';

import { useCallback, useMemo, useState } from 'react';

import { ConnectionBanner } from '../../../../../components/operator/ConnectionBanner';
import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { StatCard } from '../../../../../components/ui/StatCard';
import { useToast } from '../../../../../components/ui/ToastProvider';
import { BentoCard, BentoGrid, ScreenState } from '../../../../../design-system';

type Stats = {
  newSos: number | null;
  openOnPanel: number | null;
  pending: number | null;
  avgReachSeconds: number | null;
  hasData: boolean;
};

type IncidentRow = {
  id: string;
  state: string;
  createdAt: string;
};

export function DashboardView({
  stats,
  incidents,
  loading = false,
  error = false,
}: {
  stats: Stats;
  incidents: IncidentRow[];
  loading?: boolean;
  error?: boolean;
}) {
  const { push } = useToast();
  const { t, locale } = useOperatorPreferences();
  const emptyLabel = t('states.empty');
  const onReconnect = useCallback(
    () => push(t('web.dashboard.reconnectToast')),
    [push, t]
  );
  const [query, setQuery] = useState('');
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  const filtered = incidents.filter((row) =>
    row.id.toLowerCase().includes(query.toLowerCase())
  );

  const stateDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of incidents) {
      counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [incidents]);

  const maxStateCount = stateDistribution[0]?.[1] ?? 0;

  const screenState = loading ? 'loading' : error ? 'error' : 'idle';

  return (
    <div className="dashboard" data-testid="operator-dashboard">
      <ConnectionBanner onReconnect={onReconnect} />
      <div className="dashboard__visual-core" data-testid="dashboard-visual-core">
        <header className="dashboard__header">
          <h1>{t('web.dashboard.title')}</h1>
          <input
            className="dashboard__search"
            type="search"
            placeholder={t('web.shell.commandPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('web.dashboard.recentCases')}
          />
        </header>
        <BentoGrid>
          <BentoCard title={t('web.dashboard.widgets.totalCases')} testId="bento-new-sos">
            <StatCard
              label={t('web.dashboard.stats.newSos24h')}
              value={stats.newSos}
              emptyLabel={emptyLabel}
            />
          </BentoCard>
          <BentoCard title={t('web.dashboard.widgets.activeCases')} testId="bento-open">
            <StatCard
              label={t('web.dashboard.stats.openOnPanel')}
              value={stats.openOnPanel}
              emptyLabel={emptyLabel}
            />
          </BentoCard>
          <BentoCard
            title={t('web.dashboard.widgets.avgResponseTime')}
            span={2}
            testId="bento-pending"
          >
            <StatCard
              label={t('web.dashboard.stats.pending')}
              value={stats.pending}
              emptyLabel={emptyLabel}
            />
            <StatCard
              label={t('web.dashboard.stats.avgReachSeconds')}
              value={stats.avgReachSeconds}
              emptyLabel={emptyLabel}
            />
          </BentoCard>
        </BentoGrid>
        {stateDistribution.length > 0 ? (
          <div className="dashboard__distribution" data-testid="dashboard-state-chart">
            <h2 className="dashboard__distribution-title">
              {t('web.dashboard.stateDistribution')}
            </h2>
            <ul className="dashboard__distribution-list">
              {stateDistribution.map(([state, count]) => (
                <li key={state}>
                  <span className="dashboard__distribution-label">{state}</span>
                  <span
                    className="dashboard__distribution-bar"
                    style={{
                      width:
                        maxStateCount > 0
                          ? `${Math.round((count / maxStateCount) * 100)}%`
                          : '0%',
                    }}
                  >
                    <span className="dashboard__distribution-value">{count}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <ScreenState
        state={screenState}
        emptyLabel={emptyLabel}
        errorLabel={t('states.error')}
        loadingLabel={t('states.loading')}
        testId="dashboard-screen-state"
      >
        {!stats.hasData ? (
          <p className="dashboard__empty" data-testid="dashboard-no-data">
            {emptyLabel}
          </p>
        ) : null}
        <section className="dashboard__cases ui-card">
          <h2>{t('web.dashboard.recentCases')}</h2>
          <div id="cases" className="dashboard__table-wrap">
            <table className="dashboard__table dashboard__table--modern">
              <thead>
                <tr>
                  <th>{t('web.dashboard.table.case')}</th>
                  <th>{t('web.dashboard.table.state')}</th>
                  <th>{t('web.dashboard.table.created')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3}>{t('web.dashboard.empty')}</td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id.slice(0, 8)}…</td>
                      <td>
                        <span className="status-chip">{row.state}</span>
                      </td>
                      <td>{new Date(row.createdAt).toLocaleString(dateLocale)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </ScreenState>
    </div>
  );
}
