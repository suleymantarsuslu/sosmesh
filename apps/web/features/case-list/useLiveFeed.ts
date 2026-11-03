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

    const startPolling = () => {
      pollOnce();
      pollTimer = window.setInterval(pollOnce, 8000);
    };

    const parseSseChunk = (buffer: string): string => {
      const events: FeedEvent[] = [];
      const parts = buffer.split('\n\n');
      const remainder = parts.pop() ?? '';
      for (const part of parts) {
        const dataLine = part.split('\n').find((line) => line.startsWith('data: '));
        if (!dataLine) {
          continue;
        }
        try {
          events.push(JSON.parse(dataLine.slice(6)) as FeedEvent);
        } catch {
          // ignore malformed chunk
        }
      }
      if (events.length > 0) {
        ingestEvents(events);
      }
      return remainder;
    };

    const connectSse = async () => {
      try {
        const res = await fetch('/api/operator/events/stream', {
          headers: { Accept: 'text/event-stream' },
          cache: 'no-store',
        });
        if (!res.ok || !res.body) {
          startPolling();
          return;
        }
        setState((prev) => ({ ...prev, connected: true, mode: 'sse' }));
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!closed) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          buffer = parseSseChunk(buffer);
        }
        if (!closed) {
          setState((prev) => ({ ...prev, connected: false, stale: true }));
          startPolling();
        }
      } catch {
        if (!closed) {
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
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      window.clearInterval(staleTimer);
    };
  }, [ingestEvents, pollOnce]);

  return state;
}
