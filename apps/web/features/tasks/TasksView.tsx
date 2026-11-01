'use client';

import { BentoCard, ScreenState } from '../../design-system';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  source: string;
  assigneeDisplayName: string | null;
  teamId: string;
  incidentId: string;
};

const statusIcon: Record<string, string> = {
  PROPOSED: '📝',
  ASSIGNED: '✅',
  ACCEPTED: '🤝',
  WITHDRAWN: '↩',
  CLOSED: '⏹',
};

export function TasksView({
  tasks,
  loading = false,
  error = false,
}: {
  tasks: TaskRow[];
  loading?: boolean;
  error?: boolean;
}) {
  const { t } = useOperatorPreferences();
  const emptyLabel = t('states.empty');
  const screenState = loading ? 'loading' : error ? 'error' : tasks.length === 0 ? 'empty' : 'idle';

  return (
    <div className="tasks-view" data-testid="operator-tasks">
      <header className="dashboard__header">
        <h1>{t('web.tasks.title')}</h1>
        <p className="tasks-view__hint">{t('web.tasks.mapHint')}</p>
      </header>
      <ScreenState
        state={screenState}
        emptyLabel={emptyLabel}
        errorLabel={t('states.error')}
        loadingLabel={t('states.loading')}
      >
        <ul className="tasks-view__list">
          {tasks.map((task) => (
            <li key={task.id}>
              <BentoCard title={task.title} testId={`task-${task.id}`}>
                <p>
                  <span aria-hidden="true">{statusIcon[task.status] ?? '•'}</span>{' '}
                  {t('web.tasks.status')}: <strong>{task.status}</strong>
                </p>
                <p>
                  {t('web.tasks.source')}:{' '}
                  {task.source === 'AI' ? t('web.tasks.aiDraft') : t('web.tasks.manual')}
                </p>
                <p>
                  {t('web.tasks.assignee')}: {task.assigneeDisplayName ?? '—'}
                </p>
              </BentoCard>
            </li>
          ))}
        </ul>
      </ScreenState>
    </div>
  );
}
