import { TasksView, type TaskRow } from '../../../../../features/tasks/TasksView';
import { fetchWithSession } from '../../../../../lib/session';

export default async function OperatorTasksPage() {
  const res = await fetchWithSession('/v1/operator/tasks');
  let items: TaskRow[] = [];
  if (res.ok) {
    const body = (await res.json()) as { items: TaskRow[] };
    items = body.items ?? [];
  }
  return <TasksView tasks={items} error={!res.ok} />;
}
