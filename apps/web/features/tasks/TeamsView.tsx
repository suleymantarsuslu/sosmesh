'use client';

import { useState } from 'react';
import { BentoCard, BentoGrid, ScreenState } from '../../design-system';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { TeamFormModal } from './TeamFormModal';
import { ResourceFormModal } from './ResourceFormModal';

export type TeamRow = {
  id: string;
  name: string;
  type: string | null;
  capacity: number | null;
  contactInfo: string | null;
  status: string | null;
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
  teamId: string | null;
  isAvailableNow: boolean;
  isActive: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
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
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [editingResource, setEditingResource] = useState<ResourceRow | null>(null);

  const emptyLabel = t('states.empty');
  const screenState = loading ? 'loading' : error ? 'error' : 'idle';

  const handleEditTeam = (team: TeamRow) => {
    setEditingTeam(team);
    setTeamModalOpen(true);
  };

  const handleEditResource = (resource: ResourceRow) => {
    setEditingResource(resource);
    setResourceModalOpen(true);
  };

  const handleCloseTeamModal = () => {
    setTeamModalOpen(false);
    setEditingTeam(null);
  };

  const handleCloseResourceModal = () => {
    setResourceModalOpen(false);
    setEditingResource(null);
  };

  return (
    <div className="teams-view" data-testid="operator-teams">
      <header className="dashboard__header">
        <h1>{t('web.teams.title')}</h1>
        <div className="dashboard__header-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => setTeamModalOpen(true)}
            aria-label={t('web.teams.newTeam')}
          >
            {t('web.teams.newTeam')}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setResourceModalOpen(true)}
            aria-label={t('web.teams.newResource')}
          >
            {t('web.teams.newResource')}
          </button>
        </div>
      </header>
      <ScreenState
        state={screenState}
        emptyLabel={emptyLabel}
        errorLabel={t('states.error')}
        loadingLabel={t('states.loading')}
      >
        {teams.length === 0 && !loading && !error ? (
          <div className="teams-view__empty">
            <p>{t('web.teams.noTeams')}</p>
            <p className="teams-view__empty-hint">{t('web.teams.noTeamsHint')}</p>
          </div>
        ) : (
          <BentoGrid>
            {teams.map((team) => (
              <BentoCard key={team.id} title={team.name} testId={`team-${team.id}`}>
                {team.type && (
                  <p>
                    <strong>{t('web.teams.teamType')}:</strong> {t(`web.teams.type${team.type.charAt(0) + team.type.slice(1).toLowerCase().replace(/_/g, '')}`)}
                  </p>
                )}
                {team.status && (
                  <p>
                    <strong>{t('web.teams.teamStatus')}:</strong> {t(`web.teams.status${team.status.charAt(0) + team.status.slice(1).toLowerCase().replace(/_/g, '')}`)}
                  </p>
                )}
                <p>
                  <span aria-hidden="true">📍</span> {t('web.teams.zone')}:{' '}
                  {team.zoneCode ?? '—'}
                </p>
                <p>
                  {t('web.teams.resources')}: {team.resourceCount} · {t('web.teams.openTasks')}:{' '}
                  {team.openTaskCount}
                </p>
                <button
                  type="button"
                  className="button button--small button--secondary"
                  onClick={() => handleEditTeam(team)}
                  aria-label={`${t('web.teams.editTeam')} ${team.name}`}
                >
                  {t('web.teams.edit')}
                </button>
              </BentoCard>
            ))}
          </BentoGrid>
        )}
        <section className="teams-view__resources" aria-label={t('web.teams.resources')}>
          <h2>{t('web.teams.resources')}</h2>
          {resources.length === 0 && !loading && !error ? (
            <div className="teams-view__empty">
              <p>{t('web.teams.noResources')}</p>
              <p className="teams-view__empty-hint">{t('web.teams.noResourcesHint')}</p>
            </div>
          ) : (
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
                  <button
                    type="button"
                    className="button button--small button--secondary"
                    onClick={() => handleEditResource(resource)}
                    aria-label={`${t('web.teams.editResource')} ${resource.name}`}
                  >
                    {t('web.teams.edit')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ScreenState>
      {teamModalOpen && (
        <TeamFormModal
          team={editingTeam}
          onClose={handleCloseTeamModal}
        />
      )}
      {resourceModalOpen && (
        <ResourceFormModal
          resource={editingResource}
          teams={teams}
          onClose={handleCloseResourceModal}
        />
      )}
    </div>
  );
}
