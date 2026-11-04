'use client';

import { useMemo, useState } from 'react';

import { useOperatorPreferences } from '../../../../../components/operator/OperatorPreferencesProvider';
import { formatRelativeTime } from '../../../../../components/timeline/Timeline';
import { Icon } from '../../../../../features/cases/detail/icons';
import {
  OpsChip,
  OpsEmpty,
  OpsFilterChip,
  OpsHeader,
  OpsSearch,
  OpsState,
} from '../../../../../features/ops/OpsPrimitives';
import {
  AUDIT_ACTION_ICON,
  auditActionLabel,
  auditCategoryOf,
  type AuditCategory,
} from '../../../../../lib/audit-actions';

export type AuditItem = {
  id: string;
  action: string;
  actorId: string | null;
  actorRole: string;
  incidentId: string | null;
  createdAt: string;
  details: unknown;
};

type DateRange = 'last1h' | 'last24h' | 'last7d' | 'last30d' | 'all';

const CATEGORIES: AuditCategory[] = ['case', 'ai', 'task', 'privacy', 'other'];

const CATEGORY_COLOR: Record<AuditCategory, string> = {
  case: '#3b82f6',
  ai: '#8b5cf6',
  task: '#10b981',
  privacy: '#f59e0b',
  other: '#64748b',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#dc2626',
  COORDINATOR: '#f59e0b',
  OPERATOR: '#3b82f6',
  VIEWER: '#64748b',
};

function isInDateRange(dateStr: string, range: DateRange): boolean {
  if (range === 'all') return true;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / 3600000;
  const diffDays = diffMs / 86400000;

  switch (range) {
    case 'last1h':
      return diffHours <= 1;
    case 'last24h':
      return diffHours <= 24;
    case 'last7d':
      return diffDays <= 7;
    case 'last30d':
      return diffDays <= 30;
    default:
      return true;
  }
}

export function AuditView({
  items,
  loading = false,
  error = false,
}: {
  items: AuditItem[];
  loading?: boolean;
  error?: boolean;
}) {
  const { t, locale } = useOperatorPreferences();
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<string | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  const availableRoles = useMemo(() => {
    const roles = new Set(items.map((item) => item.actorRole).filter(Boolean));
    return Array.from(roles).sort();
  }, [items]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const cat = auditCategoryOf(item.action);
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!isInDateRange(item.createdAt, dateRange)) return false;
      if (categoryFilter !== 'all' && auditCategoryOf(item.action) !== categoryFilter) {
        return false;
      }
      if (roleFilter !== 'all' && item.actorRole !== roleFilter) return false;
      if (!needle) return true;

      const actionLabel = auditActionLabel(t, item.action).toLowerCase();
      const actorId = (item.actorId ?? '').toLowerCase();
      return (
        item.action.toLowerCase().includes(needle) ||
        actionLabel.includes(needle) ||
        actorId.includes(needle)
      );
    });
  }, [items, query, categoryFilter, roleFilter, dateRange, t]);

  const hasData = items.length > 0;
  const screenState = loading ? 'loading' : error ? 'error' : !hasData ? 'empty' : 'idle';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getRoleBadgeColor = (role: string): string => {
    return ROLE_COLORS[role] ?? ROLE_COLORS.VIEWER;
  };

  const getCategoryColor = (action: string): string => {
    const cat = auditCategoryOf(action);
    return CATEGORY_COLOR[cat];
  };

  const actionLabel = (action: string) => {
    const key = `web.audit.actions.${action}`;
    const translated = t(key);
    return translated !== key ? translated : auditActionLabel(t, action);
  };

  return (
    <div className="cd2 ops-page audit-view" data-testid="operator-audit-page">
      <OpsHeader
        icon="shield"
        title={t('web.audit.title')}
        subtitle={t('web.audit.subtitle')}
      />

      <OpsState
        state={screenState}
        icon="shield"
        emptyTitle={t('web.audit.emptyHint')}
      >
        <div className="cd2-card">
          <div className="cd2-card__body">
            <div className="ops-toolbar">
              <OpsSearch
                value={query}
                onChange={setQuery}
                placeholder={t('web.audit.searchPlaceholder')}
                label={t('web.audit.searchLabel')}
                testId="audit-search"
              />
            </div>

            <div
              className="ops-chiprow"
              role="group"
              aria-label={t('web.audit.actionTypeFilter')}
            >
              <OpsFilterChip
                active={categoryFilter === 'all'}
                onClick={() => setCategoryFilter('all')}
                count={items.length}
              >
                {t('web.activity.categoryAll')}
              </OpsFilterChip>
              {CATEGORIES.filter((c) => (categoryCounts[c] ?? 0) > 0).map((c) => (
                <OpsFilterChip
                  key={c}
                  active={categoryFilter === c}
                  onClick={() => setCategoryFilter(categoryFilter === c ? 'all' : c)}
                  count={categoryCounts[c]}
                  testId={`audit-filter-${c}`}
                >
                  {t(`web.activity.category${c.charAt(0).toUpperCase() + c.slice(1)}`)}
                </OpsFilterChip>
              ))}
            </div>

            {availableRoles.length > 1 && (
              <div className="ops-chiprow" role="group" aria-label={t('web.audit.roleFilter')}>
                <OpsFilterChip
                  active={roleFilter === 'all'}
                  onClick={() => setRoleFilter('all')}
                  count={items.length}
                >
                  {t('web.activity.categoryAll')}
                </OpsFilterChip>
                {availableRoles.map((role) => (
                  <OpsFilterChip
                    key={role}
                    active={roleFilter === role}
                    onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}
                    count={items.filter((item) => item.actorRole === role).length}
                    testId={`audit-filter-role-${role}`}
                  >
                    {role}
                  </OpsFilterChip>
                ))}
              </div>
            )}

            <div className="ops-chiprow" role="group" aria-label={t('web.audit.dateRange')}>
              {(['last1h', 'last24h', 'last7d', 'last30d', 'all'] as DateRange[]).map(
                (range) => (
                  <OpsFilterChip
                    key={range}
                    active={dateRange === range}
                    onClick={() => setDateRange(range)}
                    testId={`audit-filter-${range}`}
                  >
                    {t(`web.audit.${range}`)}
                  </OpsFilterChip>
                )
              )}
            </div>

            {filteredItems.length === 0 && items.length > 0 ? (
              <OpsEmpty
                icon="search"
                title={t('web.audit.noMatches')}
                hint={t('web.audit.noMatchesHint')}
                testId="audit-no-matches"
              />
            ) : (
              <div className="audit-table-wrap">
                <table className="audit-table" data-testid="audit-table">
                  <thead>
                    <tr>
                      <th>{t('web.audit.table.timestamp')}</th>
                      <th>{t('web.audit.table.action')}</th>
                      <th>{t('web.audit.table.actor')}</th>
                      <th>{t('web.audit.table.role')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((row) => {
                      const shortId = row.actorId ? row.actorId.slice(0, 8) : null;
                      const absoluteTime = new Date(row.createdAt).toLocaleString(dateLocale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });
                      const relativeTime = formatRelativeTime(row.createdAt, locale);
                      const categoryIcon = AUDIT_ACTION_ICON[row.action] ?? 'pulse';

                      return (
                        <tr key={row.id} data-testid={`audit-row-${row.action}`}>
                          <td className="audit-table__time">
                            <time dateTime={row.createdAt} title={absoluteTime}>
                              {absoluteTime}
                            </time>
                            <span className="audit-table__time-relative">{relativeTime}</span>
                          </td>
                          <td>
                            <span
                              className="audit-table__action-badge"
                              style={{ borderLeftColor: getCategoryColor(row.action) }}
                            >
                              <Icon name={categoryIcon} size={12} />
                              {actionLabel(row.action)}
                            </span>
                          </td>
                          <td>
                            {row.actorId ? (
                              <div className="audit-table__actor">
                                <code
                                  className="audit-table__actor-id"
                                  title={row.actorId}
                                >
                                  {shortId}
                                </code>
                                <button
                                  type="button"
                                  className="audit-table__copy-btn"
                                  onClick={() => copyToClipboard(row.actorId!, row.id)}
                                  title={t('web.audit.copyActorId')}
                                  aria-label={t('web.audit.copyActorId')}
                                >
                                  <Icon
                                    name={copiedId === row.id ? 'check' : 'copy'}
                                    size={12}
                                  />
                                  {copiedId === row.id && (
                                    <span className="audit-table__copied">
                                      {t('web.audit.copied')}
                                    </span>
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="audit-table__unknown">
                                {t('web.audit.unknownActor')}
                              </span>
                            )}
                          </td>
                          <td>
                            <OpsChip
                              tone="muted"
                              testId={`audit-role-${row.actorRole}`}
                            >
                              <span
                                className="audit-table__role-dot"
                                style={{ backgroundColor: getRoleBadgeColor(row.actorRole) }}
                              />
                              {row.actorRole}
                            </OpsChip>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </OpsState>
    </div>
  );
}
