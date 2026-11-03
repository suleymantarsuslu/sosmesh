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
        const body = (await res.json()) as { events?: { id: string }[] };
        const events = body.events ?? [];
        if (events.length > 0) {
          const lastId = events[events.length - 1].id;
          if (/^\d+$/.test(lastId)) {
            after = lastId;
          }
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

  const statusText = connected ? t('web.shell.connectionLive') : t('states.error');

  return (
    <span
      className={
        connected ? 'operator-live-status operator-live-status--ok' : 'operator-live-status'
      }
      data-testid="operator-live-status"
      data-topbar-item="live"
      role="status"
      aria-label={statusText}
    >
      <span className="operator-live-status__dot" aria-hidden />
      <span className="operator-live-status__text">{statusText}</span>
    </span>
  );
}
