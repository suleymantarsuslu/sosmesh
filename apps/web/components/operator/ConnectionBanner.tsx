'use client';

import { useEffect, useState } from 'react';

import { useOperatorPreferences } from './OperatorPreferencesProvider';

type Props = {
  onReconnect?: () => void;
};

export function ConnectionBanner({ onReconnect }: Props) {
  const { t } = useOperatorPreferences();
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    let after = '0';

    const poll = async () => {
      try {
        const res = await fetch(`/api/operator/events?after=${after}`);
        if (!res.ok) {
          setDisconnected(true);
          return;
        }
        const body = (await res.json()) as { events?: { seq: string }[] };
        const events = body.events ?? [];
        if (events.length > 0) {
          after = events[events.length - 1].seq;
        }
        setDisconnected(false);
        onReconnect?.();
      } catch {
        setDisconnected(true);
      }
    };

    poll();
    const pollTimer = window.setInterval(poll, 8000);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [onReconnect]);

  if (!disconnected) {
    return null;
  }

  return (
    <div className="ui-connection-banner" role="status" data-testid="connection-disconnected">
      {t('web.shell.connectionLost')}
    </div>
  );
}
