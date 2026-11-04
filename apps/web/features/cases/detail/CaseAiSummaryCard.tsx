'use client';

import { useOperatorPreferences } from '../../../components/operator/OperatorPreferencesProvider';
import { AiStatusBadge } from '../../ai/AiStatusBadge';
import type { AiTriageView, UrgencySuggestion } from '../../ai/types';
import type { OperatorCaseDetail } from '../types';
import { CaseSection } from './CaseSection';
import { Icon } from './icons';

type Props = {
  detail: OperatorCaseDetail;
  triage: AiTriageView | null;
  state: 'loading' | 'ready' | 'error';
  onRetry: () => void | Promise<void>;
};

const URGENCIES: UrgencySuggestion[] = ['critical', 'high', 'medium', 'low', 'unknown'];

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Builds a minimal triage view from the stored draft suggestion in the case detail. */
function triageFromDraft(detail: OperatorCaseDetail): AiTriageView | null {
  const suggestion = detail.ai?.suggestion;
  if (!suggestion) return null;
  const urgencyRaw = suggestion.urgency_suggestion;
  const urgency = URGENCIES.find((item) => item === urgencyRaw) ?? null;
  const quotes = asStringList(suggestion.quoted_evidence).map((text) => ({ text }));
  return {
    status: 'requires_review',
    modelVersion: detail.ai?.modelVersion ?? null,
    eventType: null,
    reportedPersonCount: null,
    needs: asStringList(suggestion.needs),
    hazards: [],
    urgencySuggestion: urgency,
    missingInfo: [],
    summary: typeof suggestion.summary === 'string' ? suggestion.summary : null,
    nextStepSuggestion: null,
    sourceQuotes: quotes,
    translation: null,
    followUpQuestions: [],
    operatorOverride: null,
    analyzedAt: null,
  };
}

export function CaseAiSummaryCard({ detail, triage, state, onRetry }: Props) {
  const { t, locale } = useOperatorPreferences();
  const view = triage ?? triageFromDraft(detail);
  const fromDraft = !triage && view !== null;
  const urgency = view?.operatorOverride?.urgency ?? view?.urgencySuggestion ?? null;
  const urgencyLabels: Record<UrgencySuggestion, string> = {
    critical: t('web.ai.urgencyCritical'),
    high: t('web.ai.urgencyHigh'),
    medium: t('web.ai.urgencyMedium'),
    low: t('web.ai.urgencyLow'),
    unknown: t('web.ai.urgencyUnknown'),
  };

  const hasContent =
    view !== null && (view.status === 'completed' || view.status === 'requires_review');

  return (
    <CaseSection
      title={t('web.cases.aiSummaryTitle')}
      icon="sparkles"
      testId="case-ai-summary"
      className="cd2-card--ai"
      actions={
        <>
          {view ? <AiStatusBadge status={view.status} /> : null}
          <span className="cd2-pill cd2-pill--ai">AI</span>
        </>
      }
    >
      <div className="cd2-ai-banner" role="note" data-testid="case-ai-disclaimer">
        <Icon name="shield" size={15} />
        <span>
          {t('web.cases.aiOnlySuggests')} {t('web.cases.aiDisclaimerFull')}
        </span>
      </div>

      {state === 'loading' && !view ? (
        <div className="cd2-skeleton" aria-label={t('web.cases.aiLoading')} data-testid="ai-loading">
          <span />
          <span />
          <span />
        </div>
      ) : null}

      {state === 'error' && !view ? (
        <div className="cd2-state cd2-state--error" role="alert" data-testid="ai-load-failed">
          <Icon name="alert" size={16} />
          <span>{t('web.cases.aiLoadFailed')}</span>
          <button type="button" className="cd2-btn cd2-btn--ghost" onClick={() => void onRetry()}>
            {t('web.cases.retry')}
          </button>
        </div>
      ) : null}

      {state === 'ready' && !view ? (
        <p className="cd2-empty" data-testid="ai-no-analysis">
          {t('web.cases.aiNoAnalysis')}
        </p>
      ) : null}

      {view && !hasContent ? (
        <div
          className={`cd2-state ${view.status === 'failed' ? 'cd2-state--error' : ''}`}
          data-testid="ai-status-message"
        >
          {view.status === 'pending' || view.status === 'processing' ? (
            <span className="cd2-spinner" aria-hidden="true" />
          ) : (
            <Icon name="alert" size={16} />
          )}
          <span>
            {view.status === 'pending'
              ? t('web.ai.pending')
              : view.status === 'processing'
              ? t('web.ai.processing')
              : view.status === 'failed'
              ? t('web.ai.failed')
              : t('web.ai.unavailable')}
          </span>
        </div>
      ) : null}

      {view && hasContent ? (
        <div className="cd2-ai" data-testid="ai-triage-card">
          {fromDraft ? <p className="cd2-muted">{t('web.cases.aiFallbackNote')}</p> : null}

          <div className="cd2-ai__lead">
            {view.summary ? (
              <p className="cd2-prose cd2-prose--lead" data-testid="ai-summary">
                {view.summary}
              </p>
            ) : (
              <p className="cd2-muted">{t('web.cases.aiNoAnalysis')}</p>
            )}
            {urgency ? (
              <div className="cd2-ai__priority">
                <span className="cd2-ai__priority-label">{t('web.cases.aiPriorityLabel')}</span>
                <span
                  className={`cd2-urgency cd2-urgency--${urgency}`}
                  data-testid="ai-urgency-badge"
                >
                  {urgencyLabels[urgency]}
                </span>
                <span className="cd2-ai__priority-note">{t('web.ai.urgencyNote')}</span>
              </div>
            ) : null}
          </div>

          {view.nextStepSuggestion ? (
            <div className="cd2-field">
              <h3 className="cd2-subtitle cd2-subtitle--sm">{t('web.ai.nextStep')}</h3>
              <p className="cd2-prose" data-testid="ai-next-step">
                {view.nextStepSuggestion}
              </p>
            </div>
          ) : null}

          {view.needs.length > 0 || view.hazards.length > 0 ? (
            <div className="cd2-field">
              <h3 className="cd2-subtitle cd2-subtitle--sm">{t('web.ai.needs')} / {t('web.ai.hazards')}</h3>
              <div className="cd2-chips" data-testid="ai-needs">
                {view.needs.map((need) => (
                  <span key={`n-${need}`} className="cd2-chip cd2-chip--need">
                    {need}
                  </span>
                ))}
                {view.hazards.map((hazard) => (
                  <span key={`h-${hazard}`} className="cd2-chip cd2-chip--hazard">
                    {hazard}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {view.sourceQuotes.length > 0 ? (
            <div className="cd2-field">
              <h3 className="cd2-subtitle cd2-subtitle--sm">{t('web.cases.aiRationaleLabel')}</h3>
              <div className="cd2-quotes" data-testid="ai-source-quotes">
                {view.sourceQuotes.map((quote, index) => (
                  <blockquote key={index}>{quote.text}</blockquote>
                ))}
              </div>
            </div>
          ) : null}

          {view.missingInfo.length > 0 ? (
            <div className="cd2-field">
              <h3 className="cd2-subtitle cd2-subtitle--sm">{t('web.ai.missingInfo')}</h3>
              <ul className="cd2-list" data-testid="ai-missing-info">
                {view.missingInfo.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {view.followUpQuestions.length > 0 ? (
            <div className="cd2-field">
              <h3 className="cd2-subtitle cd2-subtitle--sm">{t('web.ai.followUpQuestions')}</h3>
              <ul className="cd2-list" data-testid="ai-follow-up">
                {view.followUpQuestions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {view.translation ? (
            <div className="cd2-field">
              <h3 className="cd2-subtitle cd2-subtitle--sm">
                {t('web.ai.translation')} · {view.translation.language}
              </h3>
              {view.translation.uncertain ? (
                <p className="cd2-muted" data-testid="ai-translation-uncertain">
                  {t('web.ai.translationUncertain')}
                </p>
              ) : null}
              <p className="cd2-prose" data-testid="ai-translation">
                {view.translation.text}
              </p>
            </div>
          ) : null}

          {view.modelVersion ? (
            <p className="cd2-meta" data-testid="ai-triage-meta">
              {t('web.ai.modelVersion')}: {view.modelVersion}
              {view.analyzedAt
                ? ` · ${t('web.ai.analyzedAt')}: ${new Date(view.analyzedAt).toLocaleString(
                    locale === 'tr' ? 'tr-TR' : 'en-GB'
                  )}`
                : ''}
            </p>
          ) : null}
        </div>
      ) : null}
    </CaseSection>
  );
}
