import {
  HistoryView,
  type HistoryIncidentRow,
  type HistoryTaskRow,
} from '../../../../../../features/tasks/HistoryView';
import { fetchWithSession } from '../../../../../../lib/session';

export default async function TaskHistoryPage() {
  const [tasksRes, incidentsRes] = await Promise.all([
    fetchWithSession('/v1/operator/tasks/history').catch(() => null),
    fetchWithSession('/v1/operator/history').catch(() => null),
  ]);

  let tasks: HistoryTaskRow[] = [];
  let incidents: HistoryIncidentRow[] = [];

  if (tasksRes?.ok) {
    const body = (await tasksRes.json()) as { items: HistoryTaskRow[] };
    tasks = body.items ?? [];
  }

  if (incidentsRes?.ok) {
    const body = (await incidentsRes.json()) as { items: HistoryIncidentRow[] };
    incidents = body.items ?? [];
  }

  return <HistoryView tasks={tasks} incidents={incidents} error={!tasksRes || !incidentsRes} />;
}
