'use client';

import { useEffect, useState } from 'react';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

export function OperatorLiveStatus() {
  const { t } = useOperatorPreferences();
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let after = '0';
    const poll = async () => {
      try {
        const res = await fetch(`/api/operator/events?after=${after}`);
        if (!res.ok) {
          setConnected(false);
          return;
        }
        const body = (await res.json()) as { events?: { seq: string }[] };
        const events = body.events ?? [];
        if (events.length > 0) {
          after = events[events.length - 1].seq;
        }
        setConnected(true);
      } catch {
        setConnected(false);
      }
    };
    poll();
    const timer = window.setInterval(poll, 8000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span
      className={
        connected ? 'operator-live-status operator-live-status--ok' : 'operator-live-status'
      }
      data-testid="operator-live-status"
      role="status"
    >
      <span className="operator-live-status__dot" aria-hidden />
      {connected ? t('web.shell.connectionLive') : t('states.error')}
    </span>
  );
}
