'use client';

import { AI_DRAFT_LABEL, type OperatorAiSuggestion } from './types';

type Props = {
  ai: OperatorAiSuggestion | null;
  loadError?: boolean;
};

export function AiSuggestionPanel({ ai, loadError }: Props) {
  return (
    <section className="case-ai-panel" aria-labelledby="case-ai-title" data-testid="case-ai-panel">
      <header className="case-ai-panel__header">
        <h2 id="case-ai-title">AI yardım önerisi</h2>
        <span className="case-ai-panel__badge" data-testid="case-ai-draft-badge">
          {AI_DRAFT_LABEL}
        </span>
      </header>
      {loadError ? (
        <p role="status">AI önerisi yüklenemedi; vaka yine işlenebilir.</p>
      ) : null}
      {!ai || !ai.suggestion ? (
        <p role="status">Henüz AI önerisi yok veya üretilemedi.</p>
      ) : (
        <dl className="case-ai-panel__body">
          <div>
            <dt>Belirsizlik</dt>
            <dd>{ai.suggestion.uncertainty === true ? 'Evet' : 'Hayır'}</dd>
          </div>
          <div>
            <dt>Dayanak alıntısı</dt>
            <dd data-testid="case-ai-evidence">
              {Array.isArray(ai.suggestion.quoted_evidence)
                ? (ai.suggestion.quoted_evidence as string[]).join(' · ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Özet ihtiyaçlar</dt>
            <dd>
              {Array.isArray(ai.suggestion.needs)
                ? (ai.suggestion.needs as string[]).join(', ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Aciliyet (taslak)</dt>
            <dd>{String(ai.suggestion.urgency_suggestion ?? 'unknown')}</dd>
          </div>
        </dl>
      )}
      <p className="case-ai-panel__disclaimer">
        AI operatör adına karar vermez; öneri yalnızca taslaktır ve doğrulanmalıdır.
      </p>
    </section>
  );
}
