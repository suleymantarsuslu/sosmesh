'use client';

import { DeliveryStateBadge } from '../../components/cases/DeliveryStateBadge';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { OperatorCaseRow } from './types';

type Props = {
  rows: OperatorCaseRow[];
  selectedId: string | null;
  onSelect: (incidentId: string) => void;
};

function getSeverityClass(priority: number): string {
  if (priority <= 1) return 'severity--critical';
  if (priority <= 2) return 'severity--high';
  if (priority <= 3) return 'severity--medium';
  return 'severity--low';
}

function formatAccuracy(meters: number | null, t: (key: string) => string): string {
  if (meters === null) return '—';
  if (meters <= 50) return t('web.cases.accuracyGood').replace('{{meters}}', meters.toString());
  if (meters <= 200) return t('web.cases.accuracyFair').replace('{{meters}}', meters.toString());
  return t('web.cases.accuracyPoor').replace('{{meters}}', meters.toString());
}

export function CaseListPanel({ rows, selectedId, onSelect }: Props) {
  const { t, locale } = useOperatorPreferences();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  return (
    <section
      className="case-list-panel case-list-panel--modern"
      aria-label={t('web.cases.listTitle')}
      data-testid="case-list-panel"
    >
      <div className="case-list-panel__header">
        <h2 className="case-list-panel__title">
          {t('web.cases.caseListTitle')}
        </h2>
        <span className="case-list-panel__count">
          {rows.length} {rows.length === 1 ? t('web.cases.caseCount').replace('{{count}}', '1') : t('web.cases.caseCount_plural').replace('{{count}}', rows.length.toString())}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="case-list-panel__empty">
          <div className="case-list-panel__empty-icon">📍</div>
          <p className="case-list-panel__empty-text">{t('web.cases.listEmpty')}</p>
        </div>
      ) : (
        <ul className="case-list-panel__list">
          {rows.map((row) => (
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
                aria-label={t('web.cases.selectCase').replace('{{id}}', row.incidentId.slice(0, 8))}
              >
                <div className="case-list-panel__item-header">
                  <span className={`case-list-panel__priority ${getSeverityClass(row.priority)}`}>
                    P{row.priority}
                  </span>
                  <span className="case-list-panel__id">
                    {row.incidentId.slice(0, 8)}
                  </span>
                </div>
                <div className="case-list-panel__item-badges">
                  <DeliveryStateBadge state={row.deliveryState} />
                  <span className="case-list-panel__accuracy">
                    {formatAccuracy(row.accuracyMeters, t)}
                  </span>
                </div>
                <time className="case-list-panel__time" dateTime={row.receivedAt}>
                  {new Date(row.receivedAt).toLocaleString(dateLocale, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
