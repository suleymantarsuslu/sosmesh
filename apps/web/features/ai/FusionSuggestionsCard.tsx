'use client';

import { useState } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { IncidentLinkSuggestionView } from './types';

type Props = {
  incidentId: string;
  suggestions: IncidentLinkSuggestionView[];
  onRefresh?: () => Promise<void>;
};

export function FusionSuggestionsCard({ incidentId, suggestions, onRefresh }: Props) {
  const { t } = useOperatorPreferences();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleAction = async (suggestionId: string, action: 'confirm' | 'reject') => {
    setBusyId(suggestionId);
    try {
      const res = await fetch(`/api/operator/link-suggestions/${suggestionId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok && onRefresh) {
        await onRefresh();
      }
    } finally {
      setBusyId(null);
    }
  };

  const formatDistance = (meters: number | null) => {
    if (meters === null) return '—';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatTimeDelta = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section
      className="ai-card ai-fusion-card"
      aria-labelledby="ai-fusion-title"
      data-testid="ai-fusion-card"
    >
      <header className="ai-card__header">
        <h3 id="ai-fusion-title">{t('web.ai.fusionTitle')}</h3>
      </header>

      <div className="ai-card__body">
        <ul className="ai-fusion-list" data-testid="ai-fusion-list">
          {suggestions.map((suggestion) => {
            const otherIncidentId =
              suggestion.incidentAId === incidentId
                ? suggestion.incidentBId
                : suggestion.incidentAId;

            return (
              <li
                key={suggestion.id}
                className="ai-fusion-item"
                data-testid="ai-fusion-item"
                data-status={suggestion.status}
              >
                <div className="ai-fusion-item__header">
                  <a
                    href={`/operator/cases/${otherIncidentId}`}
                    className="ai-fusion-item__link"
                    data-testid="ai-fusion-link"
                  >
                    Case {otherIncidentId.slice(0, 8)}…
                  </a>
                  <span className="ai-fusion-score" data-testid="ai-fusion-score">
                    {t('web.ai.fusionScore')}: {(suggestion.score * 100).toFixed(0)}%
                  </span>
                </div>

                <dl className="ai-fusion-signals">
                  {suggestion.deterministicSignals.distanceMeters !== null && (
                    <>
                      <dt>{t('web.ai.fusionDistance')}</dt>
                      <dd>{formatDistance(suggestion.deterministicSignals.distanceMeters)}</dd>
                    </>
                  )}
                  <dt>{t('web.ai.fusionTimeDelta')}</dt>
                  <dd>{formatTimeDelta(suggestion.deterministicSignals.timeDeltaSeconds)}</dd>
                </dl>

                {suggestion.aiRationale && (
                  <p className="ai-fusion-rationale" data-testid="ai-fusion-rationale">
                    {suggestion.aiRationale}
                  </p>
                )}

                {suggestion.status === 'suggested' && (
                  <div className="ai-fusion-actions">
                    <button
                      type="button"
                      className="ui-button ui-button--sm"
                      disabled={busyId === suggestion.id}
                      onClick={() => handleAction(suggestion.id, 'confirm')}
                      data-testid="ai-fusion-confirm"
                    >
                      {t('web.ai.fusionConfirm')}
                    </button>
                    <button
                      type="button"
                      className="ui-button ui-button--sm ui-button--secondary"
                      disabled={busyId === suggestion.id}
                      onClick={() => handleAction(suggestion.id, 'reject')}
                      data-testid="ai-fusion-reject"
                    >
                      {t('web.ai.fusionReject')}
                    </button>
                  </div>
                )}

                {suggestion.status === 'confirmed' && (
                  <div className="ai-fusion-status ai-fusion-status--confirmed">
                    {t('web.ai.fusionConfirmed')}
                    {suggestion.decidedBy && ` · ${suggestion.decidedBy.displayName}`}
                  </div>
                )}

                {suggestion.status === 'rejected' && (
                  <div className="ai-fusion-status ai-fusion-status--rejected">
                    {t('web.ai.fusionRejected')}
                    {suggestion.decidedBy && ` · ${suggestion.decidedBy.displayName}`}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
