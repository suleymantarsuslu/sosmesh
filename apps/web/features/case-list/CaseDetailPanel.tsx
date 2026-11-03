'use client';

import Link from 'next/link';

import { Card } from '../../components/ui/Card';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { DeliveryStateBadge } from '../../components/cases/DeliveryStateBadge';

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
      <Card title={t('web.caseDetail.title')} className="cases-detail-panel">
        <p className="cases-detail-panel__empty">{t('web.caseDetail.emptyMessage')}</p>
      </Card>
    );
  }

  return (
    <Card title={t('web.caseDetail.title')} className="cases-detail-panel">
      <div data-testid="case-detail-panel">
      <dl className="cases-detail-panel__meta">
        <div>
          <dt>{t('web.caseDetail.priority')}</dt>
          <dd>{row.priority}</dd>
        </div>
        <div>
          <dt>{t('web.caseDetail.state')}</dt>
          <dd><DeliveryStateBadge state={row.deliveryState} /></dd>
        </div>
        <div>
          <dt>{t('web.caseDetail.location')}</dt>
          <dd>{t(`web.locationStatuses.${row.locationStatus}`) || row.locationStatus}</dd>
        </div>
      </dl>
      <h3>{t('web.caseDetail.timelineTitle')}</h3>
      <ol className="cases-detail-panel__timeline">
        {timeline.length === 0 ? (
          <li>{t('web.caseDetail.timelineEmpty')}</li>
        ) : (
          timeline.map((entry) => (
            <li key={entry.id}>
              <DeliveryStateBadge state={entry.deliveryState} /> · {entry.source}
            </li>
          ))
        )}
      </ol>
      <Link href={`/operator/cases/${row.incidentId}`}>{t('web.caseDetail.fullCaseLink')}</Link>
      </div>
    </Card>
  );
}
