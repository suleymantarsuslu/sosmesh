'use client';

import { useEffect, useRef } from 'react';

import { useLiveFeedContext } from './LiveFeedProvider';
import { useOperatorPreferences } from './OperatorPreferencesProvider';

type Props = {
  onReconnect?: () => void;
};

export function ConnectionBanner({ onReconnect }: Props) {
  const { t } = useOperatorPreferences();
  const { connected } = useLiveFeedContext();
  const wasDisconnectedRef = useRef(false);

  useEffect(() => {
    if (!connected) {
      wasDisconnectedRef.current = true;
    } else if (wasDisconnectedRef.current) {
      onReconnect?.();
      wasDisconnectedRef.current = false;
    }
  }, [connected, onReconnect]);

  if (connected) {
    return null;
  }

  return (
    <div className="ui-connection-banner" role="status" data-testid="connection-disconnected">
      {t('web.shell.connectionLost')}
    </div>
  );
}
