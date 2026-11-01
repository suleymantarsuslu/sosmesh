'use client';

import { BentoCard, BentoGrid, ScreenState } from '../../design-system';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type ActivityRow = {
  id: string;
  action: string;
  actorDisplayName: string | null;
  createdAt: string;
  summary: string;
};

export function ActivityView({
  notifications,
  activity,
  loading = false,
  error = false,
}: {
  notifications: NotificationRow[];
  activity: ActivityRow[];
  loading?: boolean;
  error?: boolean;
}) {
  const { t } = useOperatorPreferences();
  const emptyLabel = t('states.empty');
  const hasData = notifications.length > 0 || activity.length > 0;
  const screenState = loading ? 'loading' : error ? 'error' : !hasData ? 'empty' : 'idle';

  return (
    <div className="activity-view" data-testid="operator-activity">
      <header className="dashboard__header">
        <h1>{t('web.activity.title')}</h1>
      </header>
      <ScreenState
        state={screenState}
        emptyLabel={emptyLabel}
        errorLabel={t('states.error')}
        loadingLabel={t('states.loading')}
      >
        <BentoGrid>
          <BentoCard title={t('web.activity.notifications')} testId="activity-notifications">
            <ul>
              {notifications.map((row) => (
                <li key={row.id} data-unread={row.readAt ? 'false' : 'true'}>
                  <strong>{row.title}</strong>
                  <p>{row.body}</p>
                </li>
              ))}
            </ul>
          </BentoCard>
          <BentoCard title={t('web.activity.timeline')} testId="activity-timeline" span={2}>
            <ul>
              {activity.map((row) => (
                <li key={row.id}>
                  <time dateTime={row.createdAt}>{row.createdAt}</time> — {row.summary}
                  {row.actorDisplayName ? ` (${row.actorDisplayName})` : ''}
                </li>
              ))}
            </ul>
          </BentoCard>
        </BentoGrid>
      </ScreenState>
    </div>
  );
}
