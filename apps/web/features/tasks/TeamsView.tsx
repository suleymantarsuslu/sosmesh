'use client';

import { BentoCard, BentoGrid, ScreenState } from '../../design-system';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

export type TeamRow = {
  id: string;
  name: string;
  zoneCode: string | null;
  resourceCount: number;
  openTaskCount: number;
};

export type ResourceRow = {
  id: string;
  kind: string;
  name: string;
  capacity: number;
  zoneCode: string | null;
  isAvailableNow: boolean;
};

const kindIcon: Record<string, string> = {
  FIELD_TEAM: '👥',
  VEHICLE: '🚐',
  EQUIPMENT: '🧰',
  SHELTER: '🏠',
};

export function TeamsView({
  teams,
  resources,
  loading = false,
  error = false,
}: {
  teams: TeamRow[];
  resources: ResourceRow[];
  loading?: boolean;
  error?: boolean;
}) {
  const { t } = useOperatorPreferences();
  const emptyLabel = t('states.empty');
  const screenState = loading ? 'loading' : error ? 'error' : teams.length === 0 ? 'empty' : 'idle';

  return (
    <div className="teams-view" data-testid="operator-teams">
      <header className="dashboard__header">
        <h1>{t('web.teams.title')}</h1>
      </header>
      <ScreenState
        state={screenState}
        emptyLabel={emptyLabel}
        errorLabel={t('states.error')}
        loadingLabel={t('states.loading')}
      >
        <BentoGrid>
          {teams.map((team) => (
            <BentoCard key={team.id} title={team.name} testId={`team-${team.id}`}>
              <p>
                <span aria-hidden="true">📍</span> {t('web.teams.zone')}:{' '}
                {team.zoneCode ?? '—'}
              </p>
              <p>
                {t('web.teams.resources')}: {team.resourceCount} · {t('web.teams.openTasks')}:{' '}
                {team.openTaskCount}
              </p>
            </BentoCard>
          ))}
        </BentoGrid>
        <section className="teams-view__resources" aria-label={t('web.teams.resources')}>
          <h2>{t('web.teams.resources')}</h2>
          <ul className="teams-view__resource-list">
            {resources.map((resource) => (
              <li key={resource.id}>
                <span className="teams-view__resource-icon" aria-hidden="true">
                  {kindIcon[resource.kind] ?? '•'}
                </span>
                <span>{resource.name}</span>
                <span className="teams-view__badge" data-available={resource.isAvailableNow}>
                  {resource.isAvailableNow
                    ? t('web.teams.available')
                    : t('web.teams.unavailable')}
                </span>
                {resource.zoneCode ? (
                  <span className="teams-view__zone-tag">{resource.zoneCode}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </ScreenState>
    </div>
  );
}
