'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { FeedEvent } from './types';

export type LiveFeedState = {
  events: FeedEvent[];
  connected: boolean;
  stale: boolean;
  lastEventAt: number | null;
  mode: 'sse' | 'polling';
};

const STALE_MS = 45_000;

export function useLiveFeed(onEvent?: (event: FeedEvent) => void) {
  const [state, setState] = useState<LiveFeedState>({
    events: [],
    connected: false,
    stale: false,
    lastEventAt: null,
    mode: 'polling',
  });
  const afterRef = useRef('0');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const ingestEvents = useCallback((batch: FeedEvent[]) => {
    if (batch.length === 0) {
      return;
    }
    const lastId = batch[batch.length - 1].id;
    if (/^\d+$/.test(lastId)) {
      afterRef.current = lastId;
    }
    setState((prev) => ({
      ...prev,
      events: [...prev.events, ...batch].slice(-500),
      lastEventAt: Date.now(),
      stale: false,
    }));
    for (const event of batch) {
      onEventRef.current?.(event);
    }
  }, []);

  const pollOnce = useCallback(async () => {
    const res = await fetch(`/api/operator/events?after=${afterRef.current}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      setState((prev) => ({ ...prev, connected: false, stale: true, mode: 'polling' }));
      return;
    }
    const body = (await res.json()) as { events?: FeedEvent[] };
    ingestEvents(body.events ?? []);
    setState((prev) => ({ ...prev, connected: true, mode: 'polling' }));
  }, [ingestEvents]);

  useEffect(() => {
    let closed = false;
    let pollTimer: number | undefined;
    let eventSource: EventSource | undefined;
    let sseFailures = 0;
    const MAX_SSE_FAILURES = 3;

    const startPolling = () => {
      if (pollTimer) return;
      pollOnce();
      pollTimer = window.setInterval(pollOnce, 8000);
      setState((prev) => ({ ...prev, mode: 'polling' }));
    };

    const stopPolling = () => {
      if (pollTimer) {
        window.clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };

    const connectSse = () => {
      if (eventSource || closed) return;

      try {
        const url = new URL('/api/operator/events/stream', window.location.origin);
        url.searchParams.set('after', afterRef.current);
        eventSource = new EventSource(url.toString());

        eventSource.onopen = () => {
          sseFailures = 0;
          stopPolling();
          setState((prev) => ({ ...prev, connected: true, mode: 'sse' }));
        };

        eventSource.addEventListener('incident_message', (e: MessageEvent) => {
          try {
            const event = JSON.parse(e.data) as FeedEvent;
            ingestEvents([event]);
          } catch {
            // ignore malformed event
          }
        });

        eventSource.onerror = () => {
          setState((prev) => ({ ...prev, connected: false }));
          eventSource?.close();
          eventSource = undefined;
          sseFailures += 1;

          if (sseFailures >= MAX_SSE_FAILURES) {
            if (!closed) {
              startPolling();
            }
          } else if (!closed) {
            setTimeout(() => connectSse(), 2000 * sseFailures);
          }
        };
      } catch {
        sseFailures += 1;
        if (sseFailures >= MAX_SSE_FAILURES && !closed) {
          startPolling();
        }
      }
    };

    connectSse();

    const staleTimer = window.setInterval(() => {
      setState((prev) => {
        if (!prev.lastEventAt) {
          return prev;
        }
        const stale = Date.now() - prev.lastEventAt > STALE_MS;
        return stale === prev.stale ? prev : { ...prev, stale };
      });
    }, 5000);

    return () => {
      closed = true;
      if (eventSource) {
        eventSource.close();
      }
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      window.clearInterval(staleTimer);
    };
  }, [ingestEvents, pollOnce]);

  return state;
}
