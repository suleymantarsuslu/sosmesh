'use client';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { AiTriageView, TranscriptView, SparkVisionView, SamVisionView, IncidentLinkSuggestionView } from './types';
import { AiTriageCard } from './AiTriageCard';
import { TranscriptCard } from './TranscriptCard';
import { PhotoAnalysisCard } from './PhotoAnalysisCard';
import { FusionSuggestionsCard } from './FusionSuggestionsCard';
import { AiStatusBadge } from './AiStatusBadge';

type Props = {
  incidentId: string;
  triage: AiTriageView | null;
  transcript: TranscriptView | null;
  sparkVision: SparkVisionView | null;
  samVision: SamVisionView | null;
  linkSuggestions: IncidentLinkSuggestionView[];
  isSynthetic?: boolean;
  onRefresh?: () => Promise<void>;
};

export function AiIntelligencePanel({
  incidentId,
  triage,
  transcript,
  sparkVision,
  samVision,
  linkSuggestions,
  isSynthetic = false,
  onRefresh,
}: Props) {
  const { t } = useOperatorPreferences();

  const hasAnyData = triage || transcript || sparkVision || samVision || linkSuggestions.length > 0;

  return (
    <section
      className="ai-intelligence-panel"
      aria-labelledby="ai-panel-title"
      data-testid="ai-intelligence-panel"
    >
      <header className="ai-intelligence-panel__header">
        <h2 id="ai-panel-title">{t('web.ai.title')}</h2>
        {isSynthetic && (
          <span className="ai-badge ai-badge--synthetic" data-testid="ai-synthetic-badge">
            {t('web.ai.syntheticBadge')}
          </span>
        )}
      </header>

      <div className="ai-intelligence-panel__disclaimer" role="note">
        {t('web.ai.disclaimer')}
      </div>

      {!hasAnyData && (
        <div className="ai-intelligence-panel__empty" role="status">
          <AiStatusBadge status={triage?.status || 'unavailable'} />
          <p>{t('web.ai.unavailable')}</p>
        </div>
      )}

      {triage && (
        <AiTriageCard
          incidentId={incidentId}
          triage={triage}
          onRefresh={onRefresh}
        />
      )}

      {transcript && <TranscriptCard transcript={transcript} />}

      {(sparkVision || samVision) && (
        <PhotoAnalysisCard
          sparkVision={sparkVision}
          samVision={samVision}
        />
      )}

      {linkSuggestions.length > 0 && (
        <FusionSuggestionsCard
          incidentId={incidentId}
          suggestions={linkSuggestions}
          onRefresh={onRefresh}
        />
      )}
    </section>
  );
}
