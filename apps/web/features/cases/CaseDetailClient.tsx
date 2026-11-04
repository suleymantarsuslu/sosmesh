'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type {
  AiTriageView,
  TranscriptView,
  SparkVisionView,
  SamVisionView,
  IncidentLinkSuggestionView,
} from '../ai/types';

import { CaseDetailView } from './CaseDetailView';
import type { OperatorCaseDetail } from './types';

type AiData = {
  triage: AiTriageView | null;
  transcript: TranscriptView | null;
  sparkVision: SparkVisionView | null;
  samVision: SamVisionView | null;
  linkSuggestions: IncidentLinkSuggestionView[];
};

export function CaseDetailClient({ incidentId }: { incidentId: string }) {
  const { locale, t } = useOperatorPreferences();
  const [detail, setDetail] = useState<OperatorCaseDetail | null>(null);
  const [aiData, setAiData] = useState<AiData | null>(null);
  const [aiState, setAiState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const seenSent = useRef(false);

  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/operator/cases/${incidentId}/detail?locale=${locale}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      setError('load');
      setDetail(null);
      return;
    }
    const body = (await res.json()) as OperatorCaseDetail;
    setDetail(body);
    setError(null);
  }, [incidentId, locale]);

  const loadAiData = useCallback(async () => {
    try {
      const res = await fetch(`/api/operator/cases/${incidentId}/ai?locale=${locale}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as AiData;
        setAiData(data);
        setAiState('ready');
        return;
      }
    } catch {
      // fall through to the error state
    }
    setAiState('error');
  }, [incidentId, locale]);

  const recordSeen = useCallback(async () => {
    const res = await fetch(`/api/operator/cases/${incidentId}/seen`, { method: 'POST' });
    if (res.ok) {
      const body = (await res.json()) as {
        created: boolean;
        messageEventId: string | null;
        version?: number;
        reviewStatus?: string;
      };
      if (body.version !== undefined && detail) {
        setDetail({ ...detail, version: body.version, reviewStatus: body.reviewStatus || detail.reviewStatus });
      }
    }
  }, [incidentId, detail]);

  const refresh = useCallback(async () => {
    await loadDetail();
    await loadAiData();
  }, [loadDetail, loadAiData]);

  useEffect(() => {
    void (async () => {
      await loadDetail();
      await loadAiData();
      if (!seenSent.current) {
        seenSent.current = true;
        await recordSeen();
        await refresh();
      }
    })();
  }, [loadDetail, loadAiData, recordSeen, refresh]);

  if (error) {
    return (
      <p role="alert" data-testid="case-detail-error">
        {t('web.cases.loadFailed')}
      </p>
    );
  }
  if (!detail) {
    return <p>{t('web.common.loading')}</p>;
  }
  const normalizedAiData: AiData | null = aiData
    ? { ...aiData, linkSuggestions: aiData.linkSuggestions ?? [] }
    : null;
  return (
    <CaseDetailView
      detail={detail}
      aiData={normalizedAiData}
      aiState={aiState}
      onRefresh={refresh}
      onRetryAi={loadAiData}
    />
  );
}
