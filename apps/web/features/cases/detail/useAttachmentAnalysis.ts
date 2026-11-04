'use client';

import { useCallback, useEffect, useState } from 'react';

import type { SamSegmentResult } from '../../ai/types';

export type MaskData = {
  imageWidth: number;
  imageHeight: number;
  segments: SamSegmentResult[];
};

export type MaskState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: MaskData }
  | { status: 'empty' }
  | { status: 'failed' };

/** Loads decoded SAM masks (data URLs + normalized boxes) for one photo once its analysis is done. */
export function usePhotoMasks(attachmentId: string | null, enabled: boolean) {
  const [state, setState] = useState<MaskState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!attachmentId || !enabled) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const res = await fetch(`/api/operator/attachments/${attachmentId}/masks`, {
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.status === 404) {
          setState({ status: 'empty' });
          return;
        }
        if (!res.ok) {
          setState({ status: 'failed' });
          return;
        }
        const body = (await res.json()) as {
          found?: boolean;
          imageWidth?: number;
          imageHeight?: number;
          segments?: SamSegmentResult[];
        };
        if (cancelled) return;
        if (body.found === false) {
          setState({ status: 'empty' });
          return;
        }
        setState({
          status: 'ready',
          data: {
            imageWidth: body.imageWidth ?? 0,
            imageHeight: body.imageHeight ?? 0,
            segments: Array.isArray(body.segments) ? body.segments : [],
          },
        });
      } catch {
        if (!cancelled) setState({ status: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachmentId, enabled, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}

export type SparkSummaries =
  | { status: 'loading' }
  | { status: 'ready'; byAttachment: Record<string, string | null> }
  | { status: 'failed' };

type AttachmentListItem = {
  id: string;
  visionAnalysis?: { sparkSummary?: string | null } | null;
};

/** Spark image summaries are only exposed through the case attachment list endpoint. */
export function useSparkSummaries(incidentId: string, enabled: boolean): SparkSummaries {
  const [state, setState] = useState<SparkSummaries>({ status: 'loading' });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/operator/cases/${incidentId}/attachments`, {
          cache: 'no-store',
        });
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: 'failed' });
          return;
        }
        const body = (await res.json()) as { items?: AttachmentListItem[] };
        const byAttachment: Record<string, string | null> = {};
        for (const item of body.items ?? []) {
          byAttachment[item.id] = item.visionAnalysis?.sparkSummary ?? null;
        }
        if (!cancelled) setState({ status: 'ready', byAttachment });
      } catch {
        if (!cancelled) setState({ status: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [incidentId, enabled]);

  return state;
}
