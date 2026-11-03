'use client';

import { useCallback, useMemo } from 'react';

import { ConnectionBanner } from '../../../../../components/operator/ConnectionBanner';
import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { StatCard } from '../../../../../components/ui/StatCard';
import { useToast } from '../../../../../components/ui/ToastProvider';
import { ScreenState } from '../../../../../design-system';

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

const KPI_ICONS = ['◆', '◎', '◷', '⏱'] as const;

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
  const emptyHint = t('web.dashboard.emptyHint');
  const onReconnect = useCallback(
    () => push(t('web.dashboard.reconnectToast')),
    [push, t]
  );
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  const stateDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of incidents) {
      counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [incidents]);

  const maxStateCount = stateDistribution[0]?.[1] ?? 0;

  const screenState = loading ? 'loading' : error ? 'error' : 'idle';

  const kpiItems = [
    { label: t('web.dashboard.stats.newSos24h'), value: stats.newSos, icon: KPI_ICONS[0] },
    { label: t('web.dashboard.stats.openOnPanel'), value: stats.openOnPanel, icon: KPI_ICONS[1] },
    { label: t('web.dashboard.stats.pending'), value: stats.pending, icon: KPI_ICONS[2] },
    {
      label: t('web.dashboard.stats.avgReachSeconds'),
      value: stats.avgReachSeconds,
      icon: KPI_ICONS[3],
    },
  ];

  return (
    <div className="dashboard dashboard--command" data-testid="operator-dashboard">
      <ConnectionBanner onReconnect={onReconnect} />
      <header className="dashboard__page-head">
        <div>
          <p className="dashboard__eyebrow">{t('web.shell.nav.dashboard')}</p>
          <h1 className="dashboard__title">{t('web.dashboard.title')}</h1>
        </div>
      </header>
      <ScreenState
        state={screenState}
        emptyLabel={emptyHint}
        errorLabel={t('states.error')}
        loadingLabel={t('states.loading')}
        testId="dashboard-screen-state"
      >
        <div className="dashboard__visual-core" data-testid="dashboard-visual-core">
          <div className="dashboard__kpi-grid">
            {kpiItems.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                emptyHint={emptyHint}
                icon={item.icon}
              />
            ))}
          </div>

          <div className="dashboard__lower-grid">
            <section
              className="dashboard__panel dashboard__distribution"
              data-testid="dashboard-state-chart"
            >
              <h2 className="dashboard__panel-title">
                {t('web.dashboard.stateDistribution')}
              </h2>
              {stateDistribution.length > 0 ? (
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
              ) : (
                <div className="dashboard__chart-empty">
                  <span className="dashboard__chart-empty-icon" aria-hidden>
                    ▤
                  </span>
                  <p>{t('web.dashboard.chartEmpty')}</p>
                </div>
              )}
            </section>

            <section className="dashboard__panel dashboard__cases">
              <h2 className="dashboard__panel-title">{t('web.dashboard.recentCases')}</h2>
              <div id="cases" className="dashboard__table-wrap">
                {incidents.length === 0 ? (
                  <div className="dashboard__table-empty" data-testid="dashboard-no-data">
                    <span className="dashboard__table-empty-icon" aria-hidden>
                      ◎
                    </span>
                    <p className="dashboard__table-empty-title">
                      {t('web.dashboard.tableEmptyTitle')}
                    </p>
                    <p className="dashboard__table-empty-hint">
                      {t('web.dashboard.tableEmptyHint')}
                    </p>
                  </div>
                ) : (
                  <table className="dashboard__table dashboard__table--modern">
                    <thead>
                      <tr>
                        <th>{t('web.dashboard.table.case')}</th>
                        <th>{t('web.dashboard.table.state')}</th>
                        <th>{t('web.dashboard.table.created')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidents.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id.slice(0, 8)}…</td>
                          <td>
                            <span className="status-chip">{row.state}</span>
                          </td>
                          <td>{new Date(row.createdAt).toLocaleString(dateLocale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </div>
      </ScreenState>
    </div>
  );
}
