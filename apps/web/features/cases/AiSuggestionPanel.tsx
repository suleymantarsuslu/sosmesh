'use client';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { OperatorAiSuggestion } from './types';

type Props = {
  ai: OperatorAiSuggestion | null;
  loadError?: boolean;
};

export function AiSuggestionPanel({ ai, loadError }: Props) {
  const { t } = useOperatorPreferences();

  return (
    <section className="case-ai-panel" aria-labelledby="case-ai-title" data-testid="case-ai-panel">
      <header className="case-ai-panel__header">
        <h2 id="case-ai-title">{t('web.aiSuggestionPanel.title')}</h2>
        <span className="case-ai-panel__badge" data-testid="case-ai-draft-badge">
          {t('web.aiSuggestionPanel.draftBadge')}
        </span>
      </header>
      {loadError ? (
        <p role="status">{t('web.aiSuggestionPanel.loadError')}</p>
      ) : null}
      {!ai || !ai.suggestion ? (
        <p role="status">{t('web.aiSuggestionPanel.empty')}</p>
      ) : (
        <dl className="case-ai-panel__body">
          <div>
            <dt>{t('web.aiSuggestionPanel.uncertainty')}</dt>
            <dd>{ai.suggestion.uncertainty === true ? t('web.aiSuggestionPanel.yes') : t('web.aiSuggestionPanel.no')}</dd>
          </div>
          <div>
            <dt>{t('web.aiSuggestionPanel.evidenceQuote')}</dt>
            <dd data-testid="case-ai-evidence">
              {Array.isArray(ai.suggestion.quoted_evidence)
                ? (ai.suggestion.quoted_evidence as string[]).join(' · ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>{t('web.aiSuggestionPanel.summaryNeeds')}</dt>
            <dd>
              {Array.isArray(ai.suggestion.needs)
                ? (ai.suggestion.needs as string[]).join(', ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>{t('web.aiSuggestionPanel.urgencyDraft')}</dt>
            <dd>{String(ai.suggestion.urgency_suggestion ?? 'unknown')}</dd>
          </div>
        </dl>
      )}
      <p className="case-ai-panel__disclaimer">
        {t('web.aiSuggestionPanel.disclaimer')}
      </p>
    </section>
  );
}
