'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { Icon } from '../cases/detail/icons';
import { displayTaskTitle } from './task-title';
import {
  OpsChip,
  OpsEmpty,
  OpsFilterChip,
  OpsHeader,
  OpsSearch,
  OpsState,
  initialsOf,
  type OpsTone,
} from '../ops/OpsPrimitives';

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  source: string;
  assigneeDisplayName: string | null;
  completedById: string | null;
  completedByDisplayName: string | null;
  completedAt: string | null;
  teamId: string;
  teamName?: string | null;
  incidentId: string;
  version: number;
};

export type TeamName = { id: string; name: string };

const STATUS_ORDER = ['PROPOSED', 'ASSIGNED', 'ACCEPTED', 'WITHDRAWN', 'CLOSED'] as const;

const STATUS_KEY: Record<string, string> = {
  PROPOSED: 'web.tasks.statusProposed',
  ASSIGNED: 'web.tasks.statusAssigned',
  ACCEPTED: 'web.tasks.statusAccepted',
  WITHDRAWN: 'web.tasks.statusWithdrawn',
  CLOSED: 'web.tasks.statusClosed',
};

const STATUS_TONE: Record<string, OpsTone> = {
  PROPOSED: 'warn',
  ASSIGNED: 'info',
  ACCEPTED: 'ok',
  WITHDRAWN: 'muted',
  CLOSED: 'muted',
};

type ViewMode = 'list' | 'board';
type SourceFilter = 'all' | 'AI' | 'MANUAL';

export function TasksView({
  tasks,
  teams = [],
  focusTaskId,
  loading = false,
  error = false,
  onComplete,
}: {
  tasks: TaskRow[];
  teams?: TeamName[];
  /** Highlights (and scrolls to) a task, e.g. when arriving from a confirmed assignment. */
  focusTaskId?: string;
  loading?: boolean;
  error?: boolean;
  onComplete?: (taskId: string, version: number) => Promise<void>;
}) {
  const { t } = useOperatorPreferences();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [source, setSource] = useState<SourceFilter>('all');
  const [view, setView] = useState<ViewMode>('list');
  const [completing, setCompleting] = useState<string | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<string | null>(null);

  useEffect(() => {
    if (focusTaskId) {
      document
        .querySelector(`[data-testid="task-${CSS.escape(focusTaskId)}"]`)
        ?.scrollIntoView({ block: 'center' });
    }
  }, [focusTaskId, tasks.length]);

  const teamName = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      counts[task.status] = (counts[task.status] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (status !== 'all' && task.status !== status) {
        return false;
      }
      if (source !== 'all' && task.source !== source) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        task.title.toLowerCase().includes(needle) ||
        (task.assigneeDisplayName ?? '').toLowerCase().includes(needle) ||
        (teamName.get(task.teamId) ?? '').toLowerCase().includes(needle)
      );
    });
  }, [tasks, query, status, source, teamName]);

  const statusLabel = (value: string) => (STATUS_KEY[value] ? t(STATUS_KEY[value]) : value);
  const screenState = loading ? 'loading' : error ? 'error' : tasks.length === 0 ? 'empty' : 'idle';
  const filtersActive = query.trim() !== '' || status !== 'all' || source !== 'all';
  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setSource('all');
  };

  const handleComplete = async (task: TaskRow) => {
    if (!onComplete) {
      return;
    }
    setCompleting(task.id);
    try {
      await onComplete(task.id, task.version);
      setConfirmComplete(null);
    } finally {
      setCompleting(null);
    }
  };

  const renderCard = (task: TaskRow) => {
    const assignee = task.assigneeDisplayName;
    const team = task.teamName ?? teamName.get(task.teamId);
    const sentToTeam =
      !assignee && team && (task.status === 'ASSIGNED' || task.status === 'ACCEPTED');
    const canComplete =
      task.status === 'ASSIGNED' || task.status === 'ACCEPTED' || task.status === 'PROPOSED';
    const isCompleting = completing === task.id;
    const showConfirm = confirmComplete === task.id;

    return (
      <li
        key={task.id}
        className="ops-task"
        data-testid={`task-${task.id}`}
        data-status={task.status}
      >
        <div className="ops-task__top">
          <OpsChip tone={STATUS_TONE[task.status] ?? 'muted'} icon="tasks">
            {statusLabel(task.status)}
          </OpsChip>
          {task.source === 'AI' ? (
            <OpsChip tone="ai" icon="sparkles">
              {t('web.tasks.aiDraft')}
            </OpsChip>
          ) : (
            <OpsChip tone="muted" icon="edit">
              {t('web.tasks.manual')}
            </OpsChip>
          )}
        </div>
        <h3 className="ops-task__title">{displayTaskTitle(task.title, task.source, t)}</h3>
        <div className="ops-task__meta">
          <span className="ops-person" title={t('web.tasks.assignee')}>
            <span className="ops-avatar" aria-hidden="true">
              {assignee ? initialsOf(assignee) : <Icon name="user" size={12} />}
            </span>
            <span className={assignee ? '' : 'ops-muted'}>
              {assignee ??
                (sentToTeam
                  ? t('web.tasks.sentToTeam').replace('{team}', team)
                  : t('web.tasks.unassigned'))}
            </span>
          </span>
          {team && !sentToTeam ? (
            <span className="ops-meta-item" title={t('web.tasks.team')}>
              <Icon name="users" size={13} />
              {team}
            </span>
          ) : null}
        </div>
        <div className="ops-task__actions">
          <Link
            href={`/operator/cases/${task.incidentId}`}
            className="ops-task__link"
            aria-label={`${t('web.tasks.openCase')}: ${task.title}`}
          >
            {t('web.tasks.openCase')}
            <Icon name="external" size={13} />
          </Link>
          {canComplete && onComplete ? (
            showConfirm ? (
              <div className="ops-task__confirm">
                <p>{t('web.tasks.completeConfirm')}</p>
                <div className="ops-task__confirm-actions">
                  <button
                    type="button"
                    className="cd2-btn cd2-btn--primary cd2-btn--sm"
                    onClick={() => handleComplete(task)}
                    disabled={isCompleting}
                  >
                    {t('common.yes')}
                  </button>
                  <button
                    type="button"
                    className="cd2-btn cd2-btn--sm"
                    onClick={() => setConfirmComplete(null)}
                    disabled={isCompleting}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="cd2-btn cd2-btn--sm"
                onClick={() => setConfirmComplete(task.id)}
                disabled={isCompleting}
              >
                <Icon name="check" size={14} />
                {t('web.tasks.complete')}
              </button>
            )
          ) : null}
        </div>
      </li>
    );
  };

  const boardColumns = STATUS_ORDER.filter((value) => status === 'all' || status === value);

  return (
    <div className="cd2 ops-page tasks-view" data-testid="operator-tasks">
      <OpsHeader
        icon="tasks"
        title={t('web.tasks.title')}
        subtitle={t('web.tasks.subtitle')}
        actions={
          <>
            <Link
              href="/operator/tasks/history"
              className="cd2-btn cd2-btn--sm"
              title={t('web.tasks.historyIcon')}
            >
              <Icon name="clock" size={14} />
              {t('web.tasks.historyTitle')}
            </Link>
            <span className="ops-count" data-testid="tasks-count">
              {t('web.tasks.countOf')
                .replace('{shown}', String(filtered.length))
                .replace('{total}', String(tasks.length))}
            </span>
          </>
        }
      />
      <p className="tasks-view__hint ops-hint">
        <Icon name="pin" size={14} />
        {t('web.tasks.mapHint')}
      </p>
      <OpsState state={screenState} icon="tasks" emptyHint={t('web.tasks.emptyHint')}>
        <section className="ops-toolbar" aria-label={t('web.tasks.filters')}>
          <OpsSearch
            value={query}
            onChange={setQuery}
            placeholder={t('web.tasks.searchPlaceholder')}
            label={t('web.tasks.searchLabel')}
            testId="tasks-search"
          />
          <label className="ops-select-wrap">
            <span className="cd2-sr-only">{t('web.tasks.source')}</span>
            <select
              className="cd2-select"
              value={source}
              onChange={(event) => setSource(event.target.value as SourceFilter)}
              data-testid="tasks-source-filter"
            >
              <option value="all">{t('web.tasks.sourceAll')}</option>
              <option value="AI">{t('web.tasks.aiDraft')}</option>
              <option value="MANUAL">{t('web.tasks.manual')}</option>
            </select>
          </label>
          <div className="ops-segment" role="group" aria-label={t('web.tasks.viewMode')}>
            <button
              type="button"
              className={`ops-segment__btn${view === 'list' ? ' is-on' : ''}`}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              data-testid="tasks-view-list"
            >
              <Icon name="list" size={14} />
              {t('web.tasks.viewList')}
            </button>
            <button
              type="button"
              className={`ops-segment__btn${view === 'board' ? ' is-on' : ''}`}
              aria-pressed={view === 'board'}
              onClick={() => setView('board')}
              data-testid="tasks-view-board"
            >
              <Icon name="grid" size={14} />
              {t('web.tasks.viewBoard')}
            </button>
          </div>
        </section>
        <div className="ops-chiprow" role="group" aria-label={t('web.tasks.status')}>
          <OpsFilterChip
            active={status === 'all'}
            onClick={() => setStatus('all')}
            count={tasks.length}
            testId="tasks-status-all"
          >
            {t('web.tasks.statusAll')}
          </OpsFilterChip>
          {STATUS_ORDER.map((value) => (
            <OpsFilterChip
              key={value}
              active={status === value}
              onClick={() => setStatus(status === value ? 'all' : value)}
              count={statusCounts[value] ?? 0}
              testId={`tasks-status-${value.toLowerCase()}`}
            >
              {statusLabel(value)}
            </OpsFilterChip>
          ))}
        </div>

        {filtered.length === 0 ? (
          <OpsEmpty
            icon="search"
            title={t('web.tasks.noMatches')}
            hint={t('web.tasks.noMatchesHint')}
            testId="tasks-no-matches"
            action={
              filtersActive ? (
                <button type="button" className="cd2-btn" onClick={clearFilters}>
                  {t('web.tasks.clearFilters')}
                </button>
              ) : undefined
            }
          />
        ) : view === 'list' ? (
          <ul className="ops-task-grid tasks-view__list">{filtered.map(renderCard)}</ul>
        ) : (
          <div className="ops-board" data-testid="tasks-board">
            {boardColumns.map((value) => {
              const items = filtered.filter((task) => task.status === value);
              return (
                <section key={value} className="ops-board__col" aria-label={statusLabel(value)}>
                  <h2 className="ops-board__head">
                    <OpsChip tone={STATUS_TONE[value] ?? 'muted'}>{statusLabel(value)}</OpsChip>
                    <span className="ops-count">{items.length}</span>
                  </h2>
                  {items.length === 0 ? (
                    <p className="cd2-empty">{t('web.tasks.columnEmpty')}</p>
                  ) : (
                    <ul className="ops-board__list">{items.map(renderCard)}</ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </OpsState>
    </div>
  );
}
