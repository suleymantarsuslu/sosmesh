'use client';

import { useMemo, useState } from 'react';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { Icon, type IconName } from '../cases/detail/icons';
import {
  OpsChip,
  OpsEmpty,
  OpsFilterChip,
  OpsHeader,
  OpsSearch,
  OpsState,
  type OpsTone,
} from '../ops/OpsPrimitives';
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

const KIND_ICON: Record<string, IconName> = {
  FIELD_TEAM: 'users',
  VEHICLE: 'route',
  EQUIPMENT: 'box',
  SHELTER: 'shield',
};

const KIND_KEY: Record<string, string> = {
  FIELD_TEAM: 'web.teams.kindFieldTeam',
  VEHICLE: 'web.teams.kindVehicle',
  EQUIPMENT: 'web.teams.kindEquipment',
  SHELTER: 'web.teams.kindShelter',
};

const TYPE_KEY: Record<string, string> = {
  GENERAL: 'web.teams.typeGeneral',
  MEDICAL: 'web.teams.typeMedical',
  SEARCH_RESCUE: 'web.teams.typeSearchRescue',
  FIRE: 'web.teams.typeFire',
  POLICE: 'web.teams.typePolice',
  TECHNICAL: 'web.teams.typeTechnical',
  LOGISTICS: 'web.teams.typeLogistics',
};

const TEAM_STATUS_KEY: Record<string, string> = {
  ACTIVE: 'web.teams.statusActive',
  STANDBY: 'web.teams.statusStandby',
  OFF_DUTY: 'web.teams.statusOffDuty',
};

const TEAM_STATUS_TONE: Record<string, OpsTone> = {
  ACTIVE: 'ok',
  STANDBY: 'warn',
  OFF_DUTY: 'muted',
};

const TEAM_STATUSES = ['ACTIVE', 'STANDBY', 'OFF_DUTY'] as const;
const KINDS = ['FIELD_TEAM', 'VEHICLE', 'EQUIPMENT', 'SHELTER'] as const;

type AvailabilityFilter = 'all' | 'available' | 'unavailable';

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
  const { t, locale } = useOperatorPreferences();
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [editingResource, setEditingResource] = useState<ResourceRow | null>(null);
  const [query, setQuery] = useState('');
  const [teamStatus, setTeamStatus] = useState<string>('all');
  const [kind, setKind] = useState<string>('all');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');

  const screenState = loading ? 'loading' : error ? 'error' : 'idle';
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';
  const label = (map: Record<string, string>, value: string | null) =>
    value ? (map[value] ? t(map[value]) : value) : '';

  const teamName = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const needle = query.trim().toLowerCase();

  const visibleTeams = useMemo(
    () =>
      teams.filter((team) => {
        if (teamStatus !== 'all' && team.status !== teamStatus) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return [team.name, team.zoneCode, team.contactInfo, team.type]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      }),
    [teams, teamStatus, needle]
  );

  const visibleResources = useMemo(
    () =>
      resources.filter((resource) => {
        if (kind !== 'all' && resource.kind !== kind) {
          return false;
        }
        if (availability === 'available' && !resource.isAvailableNow) {
          return false;
        }
        if (availability === 'unavailable' && resource.isAvailableNow) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return [resource.name, resource.zoneCode, teamName.get(resource.teamId ?? '')]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      }),
    [resources, kind, availability, needle, teamName]
  );

  const stats = useMemo(
    () => ({
      activeTeams: teams.filter((team) => team.status === 'ACTIVE').length,
      availableResources: resources.filter((r) => r.isAvailableNow).length,
      openTasks: teams.reduce((sum, team) => sum + (team.openTaskCount ?? 0), 0),
    }),
    [teams, resources]
  );

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

  const formatWindow = (resource: ResourceRow): string | null => {
    const fmt = (value: string) =>
      new Date(value).toLocaleString(dateLocale, { dateStyle: 'short', timeStyle: 'short' });
    if (resource.availableFrom && resource.availableUntil) {
      return `${fmt(resource.availableFrom)} – ${fmt(resource.availableUntil)}`;
    }
    if (resource.availableFrom) {
      return `${t('web.teams.resourceAvailableFrom')}: ${fmt(resource.availableFrom)}`;
    }
    if (resource.availableUntil) {
      return `${t('web.teams.resourceAvailableUntil')}: ${fmt(resource.availableUntil)}`;
    }
    return null;
  };

  const statTiles: { icon: IconName; value: number; label: string; tone: OpsTone }[] = [
    { icon: 'users', value: teams.length, label: t('web.teams.statTeams'), tone: 'info' },
    { icon: 'pulse', value: stats.activeTeams, label: t('web.teams.statActiveTeams'), tone: 'ok' },
    { icon: 'box', value: resources.length, label: t('web.teams.statResources'), tone: 'info' },
    {
      icon: 'check',
      value: stats.availableResources,
      label: t('web.teams.statAvailable'),
      tone: 'ok',
    },
    { icon: 'tasks', value: stats.openTasks, label: t('web.teams.openTasks'), tone: 'warn' },
  ];

  return (
    <div className="cd2 ops-page teams-view" data-testid="operator-teams">
      <OpsHeader
        icon="users"
        title={t('web.teams.title')}
        subtitle={t('web.teams.subtitle')}
        actions={
          <>
            <button
              type="button"
              className="cd2-btn cd2-btn--primary"
              onClick={() => setTeamModalOpen(true)}
              aria-label={t('web.teams.newTeam')}
            >
              <Icon name="plus" size={14} />
              {t('web.teams.newTeam')}
            </button>
            <button
              type="button"
              className="cd2-btn"
              onClick={() => setResourceModalOpen(true)}
              aria-label={t('web.teams.newResource')}
            >
              <Icon name="plus" size={14} />
              {t('web.teams.newResource')}
            </button>
          </>
        }
      />
      <OpsState state={screenState} icon="users">
        <div className="ops-stats" data-testid="teams-stats">
          {statTiles.map((tile) => (
            <div key={tile.label} className={`ops-stat ops-stat--${tile.tone}`}>
              <span className="ops-stat__icon" aria-hidden="true">
                <Icon name={tile.icon} size={16} />
              </span>
              <span className="ops-stat__value">{tile.value}</span>
              <span className="ops-stat__label">{tile.label}</span>
            </div>
          ))}
        </div>
        <section className="ops-toolbar" aria-label={t('web.teams.filters')}>
          <OpsSearch
            value={query}
            onChange={setQuery}
            placeholder={t('web.teams.searchPlaceholder')}
            label={t('web.teams.searchLabel')}
            testId="teams-search"
          />
        </section>

        <section className="ops-section" aria-labelledby="teams-heading">
          <div className="ops-section__head">
            <span className="cd2-card__icon">
              <Icon name="users" size={16} />
            </span>
            <h2 className="cd2-card__title" id="teams-heading">
              {t('web.teams.teamsHeading')}
            </h2>
            <span className="ops-count">{visibleTeams.length}</span>
          </div>
          <div className="ops-chiprow" role="group" aria-label={t('web.teams.teamStatus')}>
            <OpsFilterChip active={teamStatus === 'all'} onClick={() => setTeamStatus('all')}>
              {t('web.teams.filterAll')}
            </OpsFilterChip>
            {TEAM_STATUSES.map((value) => (
              <OpsFilterChip
                key={value}
                active={teamStatus === value}
                onClick={() => setTeamStatus(teamStatus === value ? 'all' : value)}
                count={teams.filter((team) => team.status === value).length}
              >
                {label(TEAM_STATUS_KEY, value)}
              </OpsFilterChip>
            ))}
          </div>
          {teams.length === 0 ? (
            <OpsEmpty
              icon="users"
              title={t('web.teams.noTeams')}
              hint={t('web.teams.noTeamsHint')}
              testId="teams-empty"
              action={
                <button
                  type="button"
                  className="cd2-btn cd2-btn--primary"
                  onClick={() => setTeamModalOpen(true)}
                >
                  <Icon name="plus" size={14} />
                  {t('web.teams.newTeam')}
                </button>
              }
            />
          ) : visibleTeams.length === 0 ? (
            <OpsEmpty
              icon="search"
              title={t('web.teams.noMatches')}
              hint={t('web.teams.noMatchesHint')}
              testId="teams-no-matches"
            />
          ) : (
            <ul className="ops-card-grid">
              {visibleTeams.map((team) => {
                const teamResources = resources.filter((r) => r.teamId === team.id);
                return (
                  <li key={team.id} className="ops-team cd2-card" data-testid={`team-${team.id}`}>
                    <div className="ops-team__head">
                      <span className="cd2-card__icon">
                        <Icon name="users" size={16} />
                      </span>
                      <h3 className="ops-team__name">{team.name}</h3>
                      {team.status ? (
                        <OpsChip tone={TEAM_STATUS_TONE[team.status] ?? 'muted'}>
                          {label(TEAM_STATUS_KEY, team.status)}
                        </OpsChip>
                      ) : null}
                    </div>
                    <div className="ops-chiprow ops-chiprow--tight">
                      {team.type ? (
                        <OpsChip tone="info" title={t('web.teams.teamType')}>
                          {label(TYPE_KEY, team.type)}
                        </OpsChip>
                      ) : null}
                      {team.capacity != null ? (
                        <OpsChip icon="user" title={t('web.teams.teamCapacity')}>
                          {t('web.teams.membersCount').replace('{count}', String(team.capacity))}
                        </OpsChip>
                      ) : null}
                      <OpsChip icon="pin" title={t('web.teams.zone')}>
                        {team.zoneCode ?? '—'}
                      </OpsChip>
                    </div>
                    {team.contactInfo ? (
                      <p className="ops-team__contact" title={t('web.teams.teamContact')}>
                        <Icon name="mic" size={13} />
                        {team.contactInfo}
                      </p>
                    ) : null}
                    <dl className="ops-team__counts">
                      <div>
                        <dt>{t('web.teams.resources')}</dt>
                        <dd>{team.resourceCount}</dd>
                      </div>
                      <div>
                        <dt>{t('web.teams.openTasks')}</dt>
                        <dd>{team.openTaskCount}</dd>
                      </div>
                    </dl>
                    {teamResources.length > 0 ? (
                      <p className="ops-team__resources">
                        {teamResources
                          .slice(0, 3)
                          .map((r) => r.name)
                          .join(' · ')}
                        {teamResources.length > 3 ? ` +${teamResources.length - 3}` : ''}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="cd2-btn ops-team__edit"
                      onClick={() => handleEditTeam(team)}
                      aria-label={`${t('web.teams.editTeam')} ${team.name}`}
                    >
                      <Icon name="edit" size={13} />
                      {t('web.teams.edit')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="ops-section teams-view__resources" aria-labelledby="resources-heading">
          <div className="ops-section__head">
            <span className="cd2-card__icon">
              <Icon name="box" size={16} />
            </span>
            <h2 className="cd2-card__title" id="resources-heading">
              {t('web.teams.resources')}
            </h2>
            <span className="ops-count">{visibleResources.length}</span>
          </div>
          <div className="ops-chiprow" role="group" aria-label={t('web.teams.resourceKind')}>
            <OpsFilterChip active={kind === 'all'} onClick={() => setKind('all')}>
              {t('web.teams.filterAll')}
            </OpsFilterChip>
            {KINDS.map((value) => (
              <OpsFilterChip
                key={value}
                active={kind === value}
                onClick={() => setKind(kind === value ? 'all' : value)}
                count={resources.filter((r) => r.kind === value).length}
              >
                {label(KIND_KEY, value)}
              </OpsFilterChip>
            ))}
            <span className="ops-chiprow__sep" aria-hidden="true" />
            <OpsFilterChip
              active={availability === 'available'}
              onClick={() => setAvailability(availability === 'available' ? 'all' : 'available')}
            >
              {t('web.teams.available')}
            </OpsFilterChip>
            <OpsFilterChip
              active={availability === 'unavailable'}
              onClick={() =>
                setAvailability(availability === 'unavailable' ? 'all' : 'unavailable')
              }
            >
              {t('web.teams.unavailable')}
            </OpsFilterChip>
          </div>
          {resources.length === 0 ? (
            <OpsEmpty
              icon="box"
              title={t('web.teams.noResources')}
              hint={t('web.teams.noResourcesHint')}
              testId="resources-empty"
              action={
                <button
                  type="button"
                  className="cd2-btn cd2-btn--primary"
                  onClick={() => setResourceModalOpen(true)}
                >
                  <Icon name="plus" size={14} />
                  {t('web.teams.newResource')}
                </button>
              }
            />
          ) : visibleResources.length === 0 ? (
            <OpsEmpty
              icon="search"
              title={t('web.teams.noMatches')}
              hint={t('web.teams.noMatchesHint')}
              testId="resources-no-matches"
            />
          ) : (
            <ul className="ops-card-grid teams-view__resource-list">
              {visibleResources.map((resource) => {
                const windowText = formatWindow(resource);
                const owner = resource.teamId ? teamName.get(resource.teamId) : null;
                return (
                  <li
                    key={resource.id}
                    className="ops-resource cd2-card"
                    data-testid={`resource-${resource.id}`}
                  >
                    <div className="ops-team__head">
                      <span className="cd2-card__icon">
                        <Icon name={KIND_ICON[resource.kind] ?? 'box'} size={16} />
                      </span>
                      <h3 className="ops-team__name">{resource.name}</h3>
                      <span className="teams-view__badge" data-available={resource.isAvailableNow}>
                        <OpsChip
                          tone={resource.isAvailableNow ? 'ok' : 'muted'}
                          icon={resource.isAvailableNow ? 'check' : 'pause'}
                        >
                          {resource.isAvailableNow
                            ? t('web.teams.available')
                            : t('web.teams.unavailable')}
                        </OpsChip>
                      </span>
                    </div>
                    <div className="ops-chiprow ops-chiprow--tight">
                      <OpsChip tone="info">{label(KIND_KEY, resource.kind)}</OpsChip>
                      <OpsChip title={t('web.teams.resourceCapacity')}>
                        ×{resource.capacity}
                      </OpsChip>
                      {resource.zoneCode ? (
                        <span className="teams-view__zone-tag">
                          <OpsChip icon="pin" title={t('web.teams.resourceZone')}>
                            {resource.zoneCode}
                          </OpsChip>
                        </span>
                      ) : null}
                      {!resource.isActive ? (
                        <OpsChip tone="warn">{t('web.teams.inactive')}</OpsChip>
                      ) : null}
                    </div>
                    <p className="ops-team__contact" title={t('web.teams.resourceTeam')}>
                      <Icon name="users" size={13} />
                      {owner ?? t('web.teams.noTeamAssignment')}
                    </p>
                    {windowText ? (
                      <p className="ops-team__contact">
                        <Icon name="clock" size={13} />
                        {windowText}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="cd2-btn ops-team__edit"
                      onClick={() => handleEditResource(resource)}
                      aria-label={`${t('web.teams.editResource')} ${resource.name}`}
                    >
                      <Icon name="edit" size={13} />
                      {t('web.teams.edit')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </OpsState>
      {teamModalOpen && <TeamFormModal team={editingTeam} onClose={handleCloseTeamModal} />}
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
