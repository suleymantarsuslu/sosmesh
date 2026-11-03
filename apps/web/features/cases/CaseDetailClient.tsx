'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { CaseDetailView } from './CaseDetailView';
import type { OperatorCaseDetail } from './types';
import type {
  AiTriageView,
  TranscriptView,
  SparkVisionView,
  SamVisionView,
  IncidentLinkSuggestionView,
} from '../ai/types';

type AiData = {
  triage: AiTriageView | null;
  transcript: TranscriptView | null;
  sparkVision: SparkVisionView | null;
  samVision: SamVisionView | null;
  linkSuggestions: IncidentLinkSuggestionView[];
};

export function CaseDetailClient({ incidentId }: { incidentId: string }) {
  const [detail, setDetail] = useState<OperatorCaseDetail | null>(null);
  const [aiData, setAiData] = useState<AiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seenSent = useRef(false);

  const loadDetail = useCallback(async () => {
    const res = await fetch(`/api/operator/cases/${incidentId}/detail`, { cache: 'no-store' });
    if (!res.ok) {
      setError('Vaka yüklenemedi');
      setDetail(null);
      return;
    }
    const body = (await res.json()) as OperatorCaseDetail;
    setDetail(body);
    setError(null);
  }, [incidentId]);

  const loadAiData = useCallback(async () => {
    try {
      const res = await fetch(`/api/operator/cases/${incidentId}/ai`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as AiData;
        setAiData(data);
      }
    } catch {
      setAiData({
        triage: null,
        transcript: null,
        sparkVision: null,
        samVision: null,
        linkSuggestions: [],
      });
    }
  }, [incidentId]);

  const recordSeen = useCallback(async () => {
    await fetch(`/api/operator/cases/${incidentId}/seen`, { method: 'POST' });
  }, [incidentId]);

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
        {error}
      </p>
    );
  }
  if (!detail) {
    return <p>Yükleniyor…</p>;
  }
  return <CaseDetailView detail={detail} aiData={aiData} onRefresh={refresh} />;
}
