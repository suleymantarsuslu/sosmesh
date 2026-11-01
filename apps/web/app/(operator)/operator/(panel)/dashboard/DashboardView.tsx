'use client';

import { useCallback, useState } from 'react';

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
  const { t } = useOperatorPreferences();
  const emptyLabel = t('states.empty');
  const onReconnect = useCallback(() => push('Canlı akış yeniden bağlandı'), [push]);
  const [query, setQuery] = useState('');

  const filtered = incidents.filter((row) =>
    row.id.toLowerCase().includes(query.toLowerCase())
  );

  const screenState = loading ? 'loading' : error ? 'error' : 'idle';

  return (
    <div className="dashboard" data-testid="operator-dashboard">
      <ConnectionBanner onReconnect={onReconnect} />
      <header className="dashboard__header">
        <h1>{t('web.dashboard.title')}</h1>
        <input
          className="dashboard__search"
          type="search"
          placeholder={t('web.shell.commandShortcut')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('web.dashboard.recentCases')}
        />
      </header>
      <BentoGrid>
        <BentoCard title={t('web.dashboard.widgets.totalCases')} testId="bento-new-sos">
          <StatCard label="Yeni SOS (24s)" value={stats.newSos} emptyLabel={emptyLabel} />
        </BentoCard>
        <BentoCard title={t('web.dashboard.widgets.activeCases')} testId="bento-open">
          <StatCard label="Panelde açık" value={stats.openOnPanel} emptyLabel={emptyLabel} />
        </BentoCard>
        <BentoCard title={t('web.dashboard.widgets.avgResponseTime')} span={2} testId="bento-pending">
          <StatCard label="Beklemede" value={stats.pending} emptyLabel={emptyLabel} />
          <StatCard
            label="Ort. ulaşım (sn)"
            value={stats.avgReachSeconds}
            emptyLabel={emptyLabel}
          />
        </BentoCard>
      </BentoGrid>
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
            <table className="dashboard__table">
              <thead>
                <tr>
                  <th>Vaka</th>
                  <th>Durum</th>
                  <th>Oluşturulma</th>
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
                      <td>{row.state}</td>
                      <td>{new Date(row.createdAt).toLocaleString('tr-TR')}</td>
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
