import { TeamsView, type ResourceRow, type TeamRow } from '../../../../../features/tasks/TeamsView';
import { fetchWithSession } from '../../../../../lib/session';

export default async function OperatorTeamsPage() {
  const [teamsRes, resourcesRes] = await Promise.all([
    fetchWithSession('/v1/operator/teams'),
    fetchWithSession('/v1/operator/resources'),
  ]);
  let teams: TeamRow[] = [];
  let resources: ResourceRow[] = [];
  if (teamsRes.ok) {
    const body = (await teamsRes.json()) as { items: TeamRow[] };
    teams = body.items ?? [];
  }
  if (resourcesRes.ok) {
    const body = (await resourcesRes.json()) as { items: ResourceRow[] };
    resources = body.items ?? [];
  }
  return (
    <TeamsView
      teams={teams}
      resources={resources}
      error={!teamsRes.ok && !resourcesRes.ok}
    />
  );
}
