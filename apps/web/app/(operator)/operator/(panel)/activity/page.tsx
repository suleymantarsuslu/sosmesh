import {
  ActivityView,
  type ActivityRow,
  type NotificationRow,
} from '../../../../../features/tasks/ActivityView';
import { fetchWithSession } from '../../../../../lib/session';

export default async function OperatorActivityPage() {
  const [notifRes, activityRes] = await Promise.all([
    fetchWithSession('/v1/operator/notifications'),
    fetchWithSession('/v1/operator/activity'),
  ]);
  let notifications: NotificationRow[] = [];
  let activity: ActivityRow[] = [];
  if (notifRes.ok) {
    const body = (await notifRes.json()) as { items: NotificationRow[] };
    notifications = body.items ?? [];
  }
  if (activityRes.ok) {
    const body = (await activityRes.json()) as { items: ActivityRow[] };
    activity = body.items ?? [];
  }
  return (
    <ActivityView
      notifications={notifications}
      activity={activity}
      error={!notifRes.ok && !activityRes.ok}
    />
  );
}
