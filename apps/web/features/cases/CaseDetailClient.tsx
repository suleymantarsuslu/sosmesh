'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [detail, setDetail] = useState<OperatorCaseDetail | null>(null);
  const [aiData, setAiData] = useState<AiData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [samVision, setSamVision] = useState<SamVisionView | null>(null);
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

  const photoIds = (detail?.attachments ?? [])
    .filter((a) => a.kind === 'photo' && a.visionStatus === 'completed')
    .map((a) => a.id)
    .join(',');

  useEffect(() => {
    const photoId = photoIds.split(',')[0];
    if (!photoId) {
      setSamVision(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/operator/attachments/${photoId}/masks`, { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setSamVision(null);
          return;
        }
        const body = (await res.json()) as {
          found?: boolean;
          imageWidth: number;
          imageHeight: number;
          segments: SamVisionView['segments'];
        };
        if (!cancelled) {
          setSamVision({
            attachmentId: photoId,
            model: 'sam-3.1',
            imageWidth: body.imageWidth,
            imageHeight: body.imageHeight,
            segments: body.segments ?? [],
            analyzedAt: new Date().toISOString(),
          });
        }
      } catch {
        if (!cancelled) setSamVision(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoIds]);

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
        {error}
      </p>
    );
  }
  if (!detail) {
    return <p>Yükleniyor…</p>;
  }
  const mergedAiData: AiData | null = aiData
    ? { ...aiData, samVision: aiData.samVision ?? samVision, linkSuggestions: aiData.linkSuggestions ?? [] }
    : aiData;
  return <CaseDetailView detail={detail} aiData={mergedAiData} onRefresh={refresh} />;
}
