'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { TimelineFeed, formatRelativeTime } from '../../components/timeline/Timeline';
import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { Icon, type IconName } from '../cases/detail/icons';
import {
  AUDIT_ACTION_ICON,
  auditActionLabel,
  auditCategoryOf,
  type AuditCategory as Category,
} from '../../lib/audit-actions';
import {
  OpsChip,
  OpsEmpty,
  OpsFilterChip,
  OpsHeader,
  OpsSearch,
  OpsState,
} from '../ops/OpsPrimitives';

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type ActivityRow = {
  id: string;
  action: string;
  actorDisplayName: string | null;
  incidentId?: string | null;
  createdAt: string;
  summary: string;
};

const CATEGORIES: Category[] = ['case', 'ai', 'task', 'privacy', 'other'];

const CATEGORY_COLOR: Record<Category, string> = {
  case: '#3b82f6',
  ai: '#8b5cf6',
  task: '#10b981',
  privacy: '#f59e0b',
  other: '#64748b',
};

const CATEGORY_ICON: Record<Category, IconName> = {
  case: 'message',
  ai: 'sparkles',
  task: 'tasks',
  privacy: 'shield',
  other: 'pulse',
};

const CATEGORY_KEY: Record<Category, string> = {
  case: 'web.activity.categoryCase',
  ai: 'web.activity.categoryAi',
  task: 'web.activity.categoryTask',
  privacy: 'web.activity.categoryPrivacy',
  other: 'web.activity.categoryOther',
};

export function ActivityView({
  notifications,
  activity,
  loading = false,
  error = false,
}: {
  notifications: NotificationRow[];
  activity: ActivityRow[];
  loading?: boolean;
  error?: boolean;
}) {
  const { t, locale } = useOperatorPreferences();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const hasData = notifications.length > 0 || activity.length > 0;
  const screenState = loading ? 'loading' : error ? 'error' : !hasData ? 'empty' : 'idle';

  const actionLabel = (action: string) => auditActionLabel(t, action);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of activity) {
      const c = auditCategoryOf(row.action);
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [activity]);

  const filteredActivity = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activity.filter((row) => {
      if (category !== 'all' && auditCategoryOf(row.action) !== category) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        row.action.toLowerCase().includes(needle) ||
        (row.actorDisplayName ?? '').toLowerCase().includes(needle) ||
        auditActionLabel(t, row.action).toLowerCase().includes(needle)
      );
    });
  }, [activity, category, query, t]);

  const unreadCount = notifications.filter((row) => !row.readAt).length;
  const visibleNotifications = unreadOnly
    ? notifications.filter((row) => !row.readAt)
    : notifications;

  const feedItems = filteredActivity.map((row) => {
    const cat = auditCategoryOf(row.action);
    return {
      id: row.id,
      title: actionLabel(row.action),
      description: row.actorDisplayName
        ? t('web.activity.byActor').replace('{name}', row.actorDisplayName)
        : undefined,
      meta: row.incidentId ? (
        <Link href={`/operator/cases/${row.incidentId}`} className="ops-inline-link">
          {t('web.activity.openCase')}
        </Link>
      ) : undefined,
      createdAt: row.createdAt,
      color: CATEGORY_COLOR[cat],
      icon: <Icon name={AUDIT_ACTION_ICON[row.action] ?? CATEGORY_ICON[cat]} size={12} />,
    };
  });

  return (
    <div className="cd2 ops-page activity-view" data-testid="operator-activity">
      <OpsHeader
        icon="pulse"
        title={t('web.activity.title')}
        subtitle={t('web.activity.subtitle')}
        actions={
          unreadCount > 0 ? (
            <OpsChip tone="warn" icon="bell" testId="activity-unread-count">
              {t('web.activity.unreadCount').replace('{count}', String(unreadCount))}
            </OpsChip>
          ) : undefined
        }
      />
      <OpsState state={screenState} icon="pulse" emptyHint={t('web.activity.emptyHint')}>
        <div className="ops-split">
          <section className="cd2-card" data-testid="activity-timeline">
            <header className="cd2-card__header">
              <span className="cd2-card__icon">
                <Icon name="clock" size={16} />
              </span>
              <h2 className="cd2-card__title">{t('web.activity.timeline')}</h2>
              <span className="ops-count">{filteredActivity.length}</span>
            </header>
            <div className="cd2-card__body">
              <OpsSearch
                value={query}
                onChange={setQuery}
                placeholder={t('web.activity.searchPlaceholder')}
                label={t('web.activity.searchLabel')}
                testId="activity-search"
              />
              <div className="ops-chiprow" role="group" aria-label={t('web.activity.filterByType')}>
                <OpsFilterChip
                  active={category === 'all'}
                  onClick={() => setCategory('all')}
                  count={activity.length}
                >
                  {t('web.activity.categoryAll')}
                </OpsFilterChip>
                {CATEGORIES.filter((c) => (categoryCounts[c] ?? 0) > 0).map((c) => (
                  <OpsFilterChip
                    key={c}
                    active={category === c}
                    onClick={() => setCategory(category === c ? 'all' : c)}
                    count={categoryCounts[c]}
                    testId={`activity-filter-${c}`}
                  >
                    {t(CATEGORY_KEY[c])}
                  </OpsFilterChip>
                ))}
              </div>
              {activity.length === 0 ? (
                <OpsEmpty
                  icon="clock"
                  title={t('web.activity.noActivity')}
                  hint={t('web.activity.noActivityHint')}
                  testId="activity-empty"
                />
              ) : filteredActivity.length === 0 ? (
                <OpsEmpty
                  icon="search"
                  title={t('web.activity.noMatches')}
                  hint={t('web.activity.noMatchesHint')}
                  testId="activity-no-matches"
                />
              ) : (
                <TimelineFeed items={feedItems} testId="activity-feed" />
              )}
            </div>
          </section>

          <section className="cd2-card" data-testid="activity-notifications">
            <header className="cd2-card__header">
              <span className="cd2-card__icon">
                <Icon name="bell" size={16} />
              </span>
              <h2 className="cd2-card__title">{t('web.activity.notifications')}</h2>
              <span className="ops-count">{visibleNotifications.length}</span>
            </header>
            <div className="cd2-card__body">
              <div className="ops-chiprow">
                <OpsFilterChip
                  active={unreadOnly}
                  onClick={() => setUnreadOnly(!unreadOnly)}
                  count={unreadCount}
                  testId="activity-unread-filter"
                >
                  {t('web.activity.unread')}
                </OpsFilterChip>
              </div>
              {visibleNotifications.length === 0 ? (
                <OpsEmpty
                  icon="bell"
                  title={t('web.activity.noNotifications')}
                  hint={t('web.activity.noNotificationsHint')}
                  testId="notifications-empty"
                />
              ) : (
                <ul className="ops-notif-list">
                  {visibleNotifications.map((row) => (
                    <li
                      key={row.id}
                      className={`ops-notif${row.readAt ? '' : ' is-unread'}`}
                      data-unread={row.readAt ? 'false' : 'true'}
                    >
                      <span className="ops-notif__dot" aria-hidden="true" />
                      <div className="ops-notif__main">
                        <strong className="ops-notif__title">{row.title}</strong>
                        <p className="ops-notif__body">{row.body}</p>
                        <time
                          className="timeline__time"
                          dateTime={row.createdAt}
                          title={new Date(row.createdAt).toLocaleString(
                            locale === 'tr' ? 'tr-TR' : 'en-GB'
                          )}
                        >
                          {formatRelativeTime(row.createdAt, locale)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </OpsState>
    </div>
  );
}
