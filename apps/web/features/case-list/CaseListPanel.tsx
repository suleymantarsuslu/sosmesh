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

function formatRelativeTime(dateStr: string, locale: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return locale === 'tr' ? 'Şimdi' : 'Now';
  if (diffMinutes < 60) return locale === 'tr' ? `${diffMinutes}dk` : `${diffMinutes}m`;
  if (diffHours < 24) return locale === 'tr' ? `${diffHours}sa` : `${diffHours}h`;
  if (diffDays < 7) return locale === 'tr' ? `${diffDays}g` : `${diffDays}d`;
  
  return date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-GB', { month: 'short', day: 'numeric' });
}

function getTypeIcon(sosType: string): string {
  switch (sosType) {
    case 'FIRE': return '🔥';
    case 'MEDICAL': return '🏥';
    case 'ACCIDENT': return '🚗';
    case 'CRIME': return '🚨';
    case 'NATURAL_DISASTER': return '🌪️';
    default: return '📍';
  }
}

export function CaseListPanel({ rows, selectedId, onSelect }: Props) {
  const { t, locale } = useOperatorPreferences();

  return (
    <section
      className="case-list-panel case-list-panel--modern"
      aria-label={t('web.cases.listTitle')}
      data-testid="case-list-panel"
    >
      {rows.length === 0 ? (
        <div className="case-list-panel__empty">
          <div className="case-list-panel__empty-icon">📍</div>
          <p className="case-list-panel__empty-text">{t('web.cases.listEmpty')}</p>
        </div>
      ) : (
        <ul className="case-list-panel__list">
          {rows.map((row) => {
            const isCritical = row.priority <= 1;
            return (
              <li key={row.incidentId}>
                <button
                  type="button"
                  className={
                    selectedId === row.incidentId
                      ? 'case-list-panel__card case-list-panel__card--active'
                      : 'case-list-panel__card'
                  }
                  onClick={() => onSelect(row.incidentId)}
                  data-testid={`case-list-item-${row.incidentId.slice(0, 8)}`}
                  aria-label={t('web.cases.selectCase').replace('{{id}}', row.incidentId.slice(0, 8))}
                >
                  <span className={`case-list-panel__severity-bar ${getSeverityClass(row.priority)} ${isCritical ? 'case-list-panel__severity-bar--pulse' : ''}`} aria-hidden="true" />
                  <div className="case-list-panel__card-header">
                    <span className="case-list-panel__type-icon" aria-hidden="true">{getTypeIcon(row.sosType)}</span>
                    <span className="case-list-panel__id">{row.incidentId.slice(0, 8)}</span>
                    <time className="case-list-panel__relative-time" dateTime={row.receivedAt}>
                      {formatRelativeTime(row.receivedAt, locale)}
                    </time>
                  </div>
                  <div className="case-list-panel__card-body">
                    <div className="case-list-panel__badges">
                      <span className={`case-list-panel__priority-pill ${getSeverityClass(row.priority)}`}>
                        P{row.priority}
                      </span>
                      <DeliveryStateBadge state={row.deliveryState} />
                      {row.locationApproximate && (
                        <span className="case-list-panel__location-badge" title={t('web.cases.locationApproximate')}>
                          {t('web.cases.locationApproximateShort')}
                        </span>
                      )}
                    </div>
                    <span className="case-list-panel__accuracy">
                      {formatAccuracy(row.accuracyMeters, t)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
