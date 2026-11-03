'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type FeedEvent = {
  id: string;
  messageId: string;
  incidentId: string;
  priority: number;
  locationStatus: string;
  latitude: number | null;
  longitude: number | null;
  occurredAt: string;
};

type LiveFeedContextValue = {
  connected: boolean;
  stale: boolean;
  lastEventAt: number | null;
  mode: 'sse' | 'polling';
  events: FeedEvent[];
  subscribe: (listener: (event: FeedEvent) => void) => () => void;
};

const LiveFeedContext = createContext<LiveFeedContextValue | null>(null);

const STALE_MS = 45_000;

export function LiveFeedProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    connected: false,
    stale: false,
    lastEventAt: null as number | null,
    mode: 'polling' as 'sse' | 'polling',
    events: [] as FeedEvent[],
  });
  const afterRef = useRef('0');
  const listenersRef = useRef<Set<(event: FeedEvent) => void>>(new Set());

  const subscribe = useCallback((listener: (event: FeedEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

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
      for (const listener of listenersRef.current) {
        listener(event);
      }
    }
  }, []);

  const pollOnce = useCallback(async () => {
    try {
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
    } catch {
      setState((prev) => ({ ...prev, connected: false, stale: true, mode: 'polling' }));
    }
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

  return (
    <LiveFeedContext.Provider value={{ ...state, subscribe }}>
      {children}
    </LiveFeedContext.Provider>
  );
}

export function useLiveFeedContext() {
  const context = useContext(LiveFeedContext);
  if (!context) {
    throw new Error('useLiveFeedContext must be used within LiveFeedProvider');
  }
  return context;
}
