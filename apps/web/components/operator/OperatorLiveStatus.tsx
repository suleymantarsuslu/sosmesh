'use client';

import { useLiveFeedContext } from './LiveFeedProvider';
import { useOperatorPreferences } from './OperatorPreferencesProvider';

export function OperatorLiveStatus() {
  const { t } = useOperatorPreferences();
  const { connected } = useLiveFeedContext();

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
