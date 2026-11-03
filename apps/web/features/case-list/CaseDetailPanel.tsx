'use client';

import Link from 'next/link';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
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
  const { t } = useOperatorPreferences();
  
  if (!row) {
    return (
      <Card title={t('web.cases.caseHeaderCardTitle')} className="cases-detail-panel">
        <p className="cases-detail-panel__empty">{t('web.cases.listEmpty')}</p>
      </Card>
    );
  }

  return (
    <Card title={t('web.cases.caseHeaderCardTitle')} className="cases-detail-panel">
      <div data-testid="case-detail-panel">
      <dl className="cases-detail-panel__meta">
        <div>
          <dt>{t('web.cases.tableHeaders.priority')}</dt>
          <dd>P{row.priority}</dd>
        </div>
        <div>
          <dt>{t('web.cases.filterByStatus')}</dt>
          <dd>{row.deliveryState}</dd>
        </div>
        <div>
          <dt>{t('web.cases.tableHeaders.locationStatus')}</dt>
          <dd>{row.locationStatus}</dd>
        </div>
      </dl>
      <h3>{t('web.cases.timelineTitle')}</h3>
      <ol className="cases-detail-panel__timeline">
        {timeline.length === 0 ? (
          <li>{t('web.cases.auditEmpty')}</li>
        ) : (
          timeline.map((entry) => (
            <li key={entry.id}>
              {entry.deliveryState} · {entry.source}
            </li>
          ))
        )}
      </ol>
      <Link 
        href={`/operator/cases/${row.incidentId}`}
        className="cases-detail-panel__open-button"
      >
        {t('web.cases.openFullCaseDetail')}
      </Link>
      </div>
    </Card>
  );
}
