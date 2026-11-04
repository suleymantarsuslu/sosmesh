import { TasksView, type TaskRow, type TeamName } from '../../../../../features/tasks/TasksView';
import { fetchWithSession } from '../../../../../lib/session';

export default async function OperatorTasksPage() {
  const [res, teamsRes] = await Promise.all([
    fetchWithSession('/v1/operator/tasks'),
    fetchWithSession('/v1/operator/teams').catch(() => null),
  ]);
  let items: TaskRow[] = [];
  let teams: TeamName[] = [];
  if (res.ok) {
    const body = (await res.json()) as { items: TaskRow[] };
    items = body.items ?? [];
  }
  if (teamsRes?.ok) {
    const body = (await teamsRes.json()) as { items: TeamName[] };
    teams = (body.items ?? []).map((team) => ({ id: team.id, name: team.name }));
  }
  return <TasksView tasks={items} teams={teams} error={!res.ok} />;
}
