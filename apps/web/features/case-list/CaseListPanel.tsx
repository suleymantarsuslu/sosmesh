'use client';

import { DeliveryStateBadge } from '../../components/cases/DeliveryStateBadge';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { OperatorCaseRow } from './types';

type Props = {
  rows: OperatorCaseRow[];
  selectedId: string | null;
  onSelect: (incidentId: string) => void;
};

export function CaseListPanel({ rows, selectedId, onSelect }: Props) {
  const { t, locale } = useOperatorPreferences();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  return (
    <section
      className="case-list-panel case-list-panel--modern"
      aria-label={t('web.cases.listTitle')}
      data-testid="case-list-panel"
    >
      <h2>
        {t('web.cases.listTitle')} ({rows.length})
      </h2>
      <ul className="case-list-panel__list">
        {rows.length === 0 ? (
          <li className="case-list-panel__empty">{t('web.cases.listEmpty')}</li>
        ) : (
          rows.map((row) => (
            <li key={row.incidentId}>
              <button
                type="button"
                className={
                  selectedId === row.incidentId
                    ? 'case-list-panel__item case-list-panel__item--active'
                    : 'case-list-panel__item'
                }
                onClick={() => onSelect(row.incidentId)}
                data-testid={`case-list-item-${row.incidentId.slice(0, 8)}`}
              >
                <span className="priority-chip">P{row.priority}</span>
                <span className="status-chip status-chip--muted">{row.sosType}</span>
                <DeliveryStateBadge state={row.deliveryState} />
                <time dateTime={row.receivedAt}>
                  {new Date(row.receivedAt).toLocaleString(dateLocale)}
                </time>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
