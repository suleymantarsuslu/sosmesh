'use client';

import { useState, useEffect, useRef } from 'react';
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

const STORAGE_KEY = 'sosmesh-ai-panel-collapsed';

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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const contentId = `ai-panel-content-${incidentId}`;

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const hasAnyData = triage || transcript || sparkVision || samVision || linkSuggestions.length > 0;

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  const getSeverityChip = () => {
    if (!triage?.urgencySuggestion) return null;
    
    const severityMap: Record<string, { label: string; className: string }> = {
      critical: { label: t('web.ai.urgencyCritical'), className: 'ai-severity-chip--critical' },
      high: { label: t('web.ai.urgencyHigh'), className: 'ai-severity-chip--high' },
      medium: { label: t('web.ai.urgencyMedium'), className: 'ai-severity-chip--medium' },
      low: { label: t('web.ai.urgencyLow'), className: 'ai-severity-chip--low' },
      unknown: { label: t('web.ai.urgencyUnknown'), className: 'ai-severity-chip--unknown' },
    };

    const severity = severityMap[triage.urgencySuggestion];
    if (!severity) return null;

    return (
      <span className={`ai-severity-chip ${severity.className}`} data-testid="ai-severity-chip">
        {severity.label}
      </span>
    );
  };

  return (
    <section
      className={`ai-intelligence-panel ${isCollapsed ? 'ai-intelligence-panel--collapsed' : ''}`}
      aria-labelledby="ai-panel-title"
      data-testid="ai-intelligence-panel"
    >
      <header className="ai-intelligence-panel__card-header">
        <div className="ai-intelligence-panel__card-header-content">
          <h2 id="ai-panel-title" className="ai-intelligence-panel__card-title">
            {t('web.ai.title')}
          </h2>
          <div className="ai-intelligence-panel__card-badges">
            {getSeverityChip()}
            {triage && <AiStatusBadge status={triage.status} />}
            {isSynthetic && (
              <span className="ai-badge ai-badge--synthetic" data-testid="ai-synthetic-badge">
                {t('web.ai.syntheticBadge')}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="ai-intelligence-panel__toggle"
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          aria-label={isCollapsed ? t('web.ai.expandPanel') : t('web.ai.collapsePanel')}
          data-testid="ai-panel-toggle"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="ai-intelligence-panel__chevron"
            aria-hidden="true"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      <div
        id={contentId}
        ref={contentRef}
        className="ai-intelligence-panel__content"
        aria-hidden={isCollapsed}
      >
        <div className="ai-intelligence-panel__disclaimer" role="note">
          {t('web.ai.disclaimer')}
        </div>

        {!hasAnyData && (
          <div className="ai-intelligence-panel__empty" role="status">
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
      </div>
    </section>
  );
}
