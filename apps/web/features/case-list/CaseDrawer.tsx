'use client';

import type { OperatorCaseRow } from './types';

type TimelineEntry = {
  id: string;
  deliveryState: string;
  source: string;
  createdAt: string;
};

type Props = {
  open: boolean;
  row: OperatorCaseRow | null;
  timeline: TimelineEntry[];
  onClose: () => void;
};

export function CaseDrawer({ open, row, timeline, onClose }: Props) {
  if (!open || !row) {
    return null;
  }

  return (
    <aside
      className="case-drawer"
      role="dialog"
      aria-labelledby="case-drawer-title"
      data-testid="case-drawer"
    >
      <header className="case-drawer__header">
        <h2 id="case-drawer-title">Vaka özeti</h2>
        <button type="button" onClick={onClose} aria-label="Çekmeceyi kapat">
          Kapat
        </button>
      </header>
      <dl className="case-drawer__meta">
        <div>
          <dt>Vaka</dt>
          <dd>{row.incidentId.slice(0, 8)}…</dd>
        </div>
        <div>
          <dt>Durum</dt>
          <dd>{row.incidentState}</dd>
        </div>
        <div>
          <dt>Konum</dt>
          <dd>{row.locationStatus}</dd>
        </div>
        <div>
          <dt>Doğruluk</dt>
          <dd>
            {row.accuracyMeters != null ? `${Math.round(row.accuracyMeters)} m` : 'Belirsiz'}
          </dd>
        </div>
      </dl>
      <section aria-label="Kanıt zaman çizelgesi">
        <h3>Zaman çizelgesi</h3>
        <ol className="case-drawer__timeline" data-testid="case-drawer-timeline">
          {timeline.length === 0 ? (
            <li>Henüz olay kaydı yok</li>
          ) : (
            timeline.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.deliveryState}</strong>
                <span>{entry.source}</span>
                <time dateTime={entry.createdAt}>
                  {new Date(entry.createdAt).toLocaleString('tr-TR')}
                </time>
              </li>
            ))
          )}
        </ol>
      </section>
    </aside>
  );
}
