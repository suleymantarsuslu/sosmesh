'use client';

import { useCallback, useState } from 'react';

import { ConnectionBanner } from '../../../../../components/operator/ConnectionBanner';
import { Card } from '../../../../../components/ui/Card';
import { StatCard } from '../../../../../components/ui/StatCard';
import { useToast } from '../../../../../components/ui/ToastProvider';

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
}: {
  stats: Stats;
  incidents: IncidentRow[];
}) {
  const { push } = useToast();
  const emptyLabel = 'Henüz veri yok';
  const onReconnect = useCallback(() => push('Canlı akış yeniden bağlandı'), [push]);
  const [query, setQuery] = useState('');

  const filtered = incidents.filter((row) =>
    row.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="dashboard" data-testid="operator-dashboard">
      <ConnectionBanner onReconnect={onReconnect} />
      <header className="dashboard__header">
        <h1>Panel</h1>
        <input
          className="dashboard__search"
          type="search"
          placeholder="Vaka ara (Ctrl+K komut paleti)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Vaka ara"
        />
      </header>
      <div className="dashboard__stats">
        <StatCard label="Yeni SOS (24s)" value={stats.newSos} emptyLabel={emptyLabel} />
        <StatCard label="Panelde açık" value={stats.openOnPanel} emptyLabel={emptyLabel} />
        <StatCard label="Beklemede" value={stats.pending} emptyLabel={emptyLabel} />
        <StatCard
          label="Ort. ulaşım (sn)"
          value={stats.avgReachSeconds}
          emptyLabel={emptyLabel}
        />
      </div>
      {!stats.hasData ? (
        <p className="dashboard__empty" data-testid="dashboard-no-data">
          Henüz veri yok
        </p>
      ) : null}
      <Card title="Son vakalar" className="dashboard__cases">
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
                  <td colSpan={3}>Henüz vaka yok</td>
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
          <ul className="dashboard__cards-mobile">
            {filtered.map((row) => (
              <li key={row.id} className="dashboard__case-card">
                <strong>{row.state}</strong>
                <span>{row.id.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
