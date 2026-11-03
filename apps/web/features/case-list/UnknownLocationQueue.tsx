'use client';

import { useState } from 'react';
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

export function UnknownLocationQueue({ rows, selectedId, onSelect }: Props) {
  const { t, locale } = useOperatorPreferences();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section
      className="unknown-location-queue unknown-location-queue--modern"
      aria-label={t('web.cases.unknownLocationTitle')}
      data-testid="unknown-location-queue"
    >
      <button
        type="button"
        className="unknown-location-queue__header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <h3 className="unknown-location-queue__title">
          {t('web.cases.unknownLocationTitle')}
          <span className="unknown-location-queue__count-badge">{rows.length}</span>
        </h3>
        <span className="unknown-location-queue__chevron" aria-hidden="true">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      {isExpanded && (
        <>
          <p className="unknown-location-queue__hint">
            {t('web.cases.unknownLocationHint')}
          </p>
          {rows.length === 0 ? (
            <div className="unknown-location-queue__empty">
              <p>{t('web.cases.listEmpty')}</p>
            </div>
          ) : (
            <ul className="unknown-location-queue__list">
              {rows.map((row) => (
                <li key={row.incidentId}>
                  <button
                    type="button"
                    className={
                      selectedId === row.incidentId
                        ? 'unknown-location-queue__item unknown-location-queue__item--active'
                        : 'unknown-location-queue__item'
                    }
                    onClick={() => onSelect(row.incidentId)}
                    data-testid={`unknown-queue-item-${row.incidentId.slice(0, 8)}`}
                    aria-label={t('web.cases.selectCase').replace('{{id}}', row.incidentId.slice(0, 8))}
                  >
                    <div className="unknown-location-queue__item-header">
                      <span className={`unknown-location-queue__priority ${getSeverityClass(row.priority)}`}>
                        P{row.priority}
                      </span>
                      <span className="unknown-location-queue__id">
                        {row.incidentId.slice(0, 8)}
                      </span>
                    </div>
                    <div className="unknown-location-queue__item-badges">
                      <DeliveryStateBadge state={row.deliveryState} />
                      <span className="unknown-location-queue__accuracy">
                        {formatAccuracy(row.accuracyMeters, t)}
                      </span>
                    </div>
                    <time className="unknown-location-queue__time" dateTime={row.receivedAt}>
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
        </>
      )}
    </section>
  );
}
