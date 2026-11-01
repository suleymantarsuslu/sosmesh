'use client';

import Link from 'next/link';

import { Card } from '../../components/ui/Card';

import type { OperatorCaseRow } from './types';

type TimelineEntry = {
  id: string;
  deliveryState: string;
  source: string;
  createdAt: string;
};

export function CaseDetailPanel({
  row,
  timeline,
}: {
  row: OperatorCaseRow | null;
  timeline: TimelineEntry[];
}) {
  if (!row) {
    return (
      <Card title="Vaka detayı" className="cases-detail-panel">
        <p className="cases-detail-panel__empty">Liste veya haritadan vaka seçin.</p>
      </Card>
    );
  }

  return (
    <Card title="Vaka detayı" className="cases-detail-panel">
      <div data-testid="case-detail-panel">
      <dl className="cases-detail-panel__meta">
        <div>
          <dt>Öncelik</dt>
          <dd>{row.priority}</dd>
        </div>
        <div>
          <dt>Durum</dt>
          <dd>{row.deliveryState}</dd>
        </div>
        <div>
          <dt>Konum</dt>
          <dd>{row.locationStatus}</dd>
        </div>
      </dl>
      <h3>Zaman çizelgesi</h3>
      <ol className="cases-detail-panel__timeline">
        {timeline.length === 0 ? (
          <li>Henüz kayıt yok</li>
        ) : (
          timeline.map((entry) => (
            <li key={entry.id}>
              {entry.deliveryState} · {entry.source}
            </li>
          ))
        )}
      </ol>
      <Link href={`/operator/cases/${row.incidentId}`}>Tam vaka sayfası</Link>
      </div>
    </Card>
  );
}
