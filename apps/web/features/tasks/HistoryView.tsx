'use client';

import Link from 'next/link';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { Icon } from '../cases/detail/icons';
import {
  OpsChip,
  OpsEmpty,
  OpsHeader,
  OpsState,
  initialsOf,
} from '../ops/OpsPrimitives';

export type HistoryTaskRow = {
  id: string;
  title: string;
  status: string;
  source: string;
  assigneeDisplayName: string | null;
  completedByDisplayName: string | null;
  completedAt: string | null;
  teamName: string | null;
  incidentId: string;
  createdAt: string;
  updatedAt: string;
};

export type HistoryIncidentRow = {
  incidentId: string;
  incidentState: string;
  deletedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  messageId: string | null;
  sosType: string | null;
  priority: number;
  receivedAt: string | null;
};

export function HistoryView({
  tasks,
  incidents,
  loading = false,
  error = false,
}: {
  tasks: HistoryTaskRow[];
  incidents: HistoryIncidentRow[];
  loading?: boolean;
  error?: boolean;
}) {
  const { t, locale } = useOperatorPreferences();

  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  const screenState = loading ? 'loading' : error ? 'error' : 'idle';

  return (
    <div className="cd2 ops-page history-view" data-testid="operator-history">
      <OpsHeader
        icon="clock"
        title={t('web.tasks.historyTitle')}
        subtitle={t('web.tasks.historySubtitle')}
        actions={
          <Link href="/operator/tasks" className="cd2-btn cd2-btn--sm">
            <Icon name="arrow-left" size={14} />
            {t('common.close')}
          </Link>
        }
      />
      <OpsState state={screenState} icon="clock" emptyHint={t('web.tasks.historyEmpty')}>
        {tasks.length === 0 && incidents.length === 0 ? (
          <OpsEmpty
            icon="clock"
            title={t('web.tasks.historyEmpty')}
            hint=""
            testId="history-empty"
          />
        ) : (
          <>
            {tasks.length > 0 ? (
              <section className="history-section" aria-labelledby="history-tasks-title">
                <h2 id="history-tasks-title" className="history-section__title">
                  {t('web.tasks.title')}
                </h2>
                <ul className="ops-task-grid">
                  {tasks.map((task) => {
                    const completedTime = task.completedAt
                      ? new Date(task.completedAt).toLocaleString(dateLocale, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : null;
                    return (
                      <li
                        key={task.id}
                        className="ops-task"
                        data-testid={`history-task-${task.id}`}
                        data-status={task.status}
                      >
                        <div className="ops-task__top">
                          <OpsChip tone="muted" icon="tasks">
                            {task.status === 'CLOSED' ? t('web.tasks.statusClosed') : t('web.tasks.statusWithdrawn')}
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
                        <h3 className="ops-task__title">{task.title}</h3>
                        <div className="ops-task__meta">
                          {task.assigneeDisplayName ? (
                            <span className="ops-person">
                              <span className="ops-avatar" aria-hidden="true">
                                {initialsOf(task.assigneeDisplayName)}
                              </span>
                              <span>{task.assigneeDisplayName}</span>
                            </span>
                          ) : null}
                          {task.teamName ? (
                            <span className="ops-meta-item">
                              <Icon name="users" size={13} />
                              {task.teamName}
                            </span>
                          ) : null}
                        </div>
                        {task.completedByDisplayName && completedTime ? (
                          <div className="ops-task__completed">
                            <p>
                              {t('web.tasks.completedBy').replace('{name}', task.completedByDisplayName)}
                            </p>
                            <p className="ops-muted">
                              {t('web.tasks.completedAt').replace('{time}', completedTime)}
                            </p>
                          </div>
                        ) : null}
                        <Link
                          href={`/operator/cases/${task.incidentId}`}
                          className="ops-task__link"
                          aria-label={`${t('web.tasks.openCase')}: ${task.title}`}
                        >
                          {t('web.tasks.openCase')}
                          <Icon name="external" size={13} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {incidents.length > 0 ? (
              <section className="history-section" aria-labelledby="history-incidents-title">
                <h2 id="history-incidents-title" className="history-section__title">
                  {t('web.cases.title')}
                </h2>
                <ul className="ops-incident-list">
                  {incidents.map((incident) => {
                    const deletedTime = incident.deletedAt
                      ? new Date(incident.deletedAt).toLocaleString(dateLocale, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : null;
                    return (
                      <li
                        key={incident.incidentId}
                        className="ops-incident-card"
                        data-testid={`history-incident-${incident.incidentId}`}
                      >
                        <div className="ops-incident-card__header">
                          <OpsChip tone="muted" icon="alert">
                            {incident.incidentState}
                          </OpsChip>
                          {incident.sosType ? (
                            <OpsChip tone="muted">{incident.sosType}</OpsChip>
                          ) : null}
                        </div>
                        <p className="ops-incident-card__id">
                          {incident.messageId ?? incident.incidentId}
                        </p>
                        {deletedTime ? (
                          <p className="ops-muted ops-incident-card__time">
                            {incident.archiveReason === 'completed' 
                              ? t('cases.archiveStatusCompleted') 
                              : t('cases.archiveStatusDeleted')}: {deletedTime}
                          </p>
                        ) : null}
                        <Link
                          href={`/operator/cases/${incident.incidentId}`}
                          className="ops-incident-card__link"
                        >
                          {t('web.cases.detail')}
                          <Icon name="external" size={13} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </OpsState>
    </div>
  );
}
