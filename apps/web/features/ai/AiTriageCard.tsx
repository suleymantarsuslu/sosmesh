'use client';

import { useState } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { AiTriageView, UrgencySuggestion } from './types';
import { AiStatusBadge } from './AiStatusBadge';

type Props = {
  incidentId: string;
  triage: AiTriageView;
  onRefresh?: () => Promise<void>;
};

export function AiTriageCard({ incidentId, triage, onRefresh }: Props) {
  const { t, locale } = useOperatorPreferences();
  const [busy, setBusy] = useState(false);

  const urgencyLabelMap: Record<UrgencySuggestion, string> = {
    critical: t('web.ai.urgencyCritical'),
    high: t('web.ai.urgencyHigh'),
    medium: t('web.ai.urgencyMedium'),
    low: t('web.ai.urgencyLow'),
    unknown: t('web.ai.urgencyUnknown'),
  };

  const handleAcceptUrgency = async () => {
    if (!triage.urgencySuggestion) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/operator/cases/${incidentId}/ai-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urgency: triage.urgencySuggestion,
        }),
      });
      if (res.ok && onRefresh) {
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const displayUrgency = triage.operatorOverride?.urgency || triage.urgencySuggestion;

  return (
    <section
      className="ai-card ai-triage-card"
      aria-labelledby="ai-triage-title"
      data-testid="ai-triage-card"
    >
      <header className="ai-card__header">
        <h3 id="ai-triage-title">{t('web.ai.triageTitle')}</h3>
        <AiStatusBadge status={triage.status} />
      </header>

      {triage.status === 'completed' && (
        <div className="ai-card__body">
          {triage.operatorOverride && (
            <div className="ai-override-notice" role="note" data-testid="ai-operator-override">
              {t('web.ai.operatorOverride')}: {triage.operatorOverride.overriddenBy}
            </div>
          )}

          <div className="ai-triage__urgency">
            <div className="ai-triage__urgency-label">
              <strong>{t('web.ai.urgencyLabel')}</strong>
              <span className="ai-triage__note">{t('web.ai.urgencyNote')}</span>
            </div>
            <div className="ai-triage__urgency-value">
              {displayUrgency && (
                <span
                  className={`urgency-badge urgency-badge--${displayUrgency}`}
                  data-testid="ai-urgency-badge"
                >
                  {urgencyLabelMap[displayUrgency]}
                </span>
              )}
              {!triage.operatorOverride && triage.urgencySuggestion && (
                <div className="ai-triage__actions">
                  <button
                    type="button"
                    className="ui-button ui-button--sm"
                    disabled={busy}
                    onClick={handleAcceptUrgency}
                    data-testid="ai-accept-urgency"
                  >
                    {t('web.ai.acceptUrgency')}
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button--sm ui-button--secondary"
                    disabled={busy}
                    data-testid="ai-change-urgency"
                  >
                    {t('web.ai.changeUrgency')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {triage.eventType && (
            <dl className="ai-field">
              <dt>{t('web.ai.eventType')}</dt>
              <dd data-testid="ai-event-type">
                {t(`web.eventTypes.${triage.eventType}`) !== `web.eventTypes.${triage.eventType}` 
                  ? t(`web.eventTypes.${triage.eventType}`)
                  : triage.eventType}
              </dd>
            </dl>
          )}

          {triage.reportedPersonCount !== null && (
            <dl className="ai-field">
              <dt>{t('web.ai.personCount')}</dt>
              <dd data-testid="ai-person-count">{triage.reportedPersonCount}</dd>
            </dl>
          )}

          {triage.needs.length > 0 && (
            <div className="ai-field">
              <strong>{t('web.ai.needs')}</strong>
              <div className="ai-chips" data-testid="ai-needs">
                {triage.needs.map((need, idx) => (
                  <span key={idx} className="ai-chip ai-chip--need">
                    {need}
                  </span>
                ))}
              </div>
            </div>
          )}

          {triage.hazards.length > 0 && (
            <div className="ai-field">
              <strong>{t('web.ai.hazards')}</strong>
              <div className="ai-chips" data-testid="ai-hazards">
                {triage.hazards.map((hazard, idx) => (
                  <span key={idx} className="ai-chip ai-chip--hazard">
                    {hazard}
                  </span>
                ))}
              </div>
            </div>
          )}

          {triage.summary && (
            <div className="ai-field">
              <strong>{t('web.ai.summary')}</strong>
              <p className="ai-text" data-testid="ai-summary">
                {triage.summary}
              </p>
            </div>
          )}

          {triage.missingInfo.length > 0 && (
            <div className="ai-field">
              <strong>{t('web.ai.missingInfo')}</strong>
              <ul className="ai-list" data-testid="ai-missing-info">
                {triage.missingInfo.map((info, idx) => (
                  <li key={idx}>{info}</li>
                ))}
              </ul>
            </div>
          )}

          {triage.nextStepSuggestion && (
            <div className="ai-field">
              <strong>{t('web.ai.nextStep')}</strong>
              <p className="ai-text" data-testid="ai-next-step">
                {triage.nextStepSuggestion}
              </p>
            </div>
          )}

          {triage.sourceQuotes.length > 0 && (
            <div className="ai-field">
              <strong>{t('web.ai.sourceQuotes')}</strong>
              <div className="ai-quotes" data-testid="ai-source-quotes">
                {triage.sourceQuotes.map((quote, idx) => (
                  <blockquote key={idx} className="ai-quote">
                    {quote.text}
                  </blockquote>
                ))}
              </div>
            </div>
          )}

          {triage.translation && (
            <div className="ai-field">
              <strong>{t('web.ai.translation')}</strong>
              {triage.translation.uncertain && (
                <span className="ai-warning" role="note" data-testid="ai-translation-uncertain">
                  {t('web.ai.translationUncertain')}
                </span>
              )}
              <p className="ai-text" data-testid="ai-translation">
                {triage.translation.text}
              </p>
              <small className="ai-meta">
                {t('web.ai.translationLanguage')}: {triage.translation.language}
              </small>
            </div>
          )}

          {triage.followUpQuestions.length > 0 && (
            <div className="ai-field">
              <strong>{t('web.ai.followUpQuestions')}</strong>
              <ul className="ai-list" data-testid="ai-follow-up">
                {triage.followUpQuestions.map((question, idx) => (
                  <li key={idx}>{question}</li>
                ))}
              </ul>
            </div>
          )}

          {triage.modelVersion && (
            <div className="ai-meta" data-testid="ai-triage-meta">
              <small>
                {t('web.ai.modelVersion')}: {triage.modelVersion}
              </small>
              {triage.analyzedAt && (
                <small>
                  {' · '}
                  {t('web.ai.analyzedAt')}:{' '}
                  {new Date(triage.analyzedAt).toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-GB')}
                </small>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
