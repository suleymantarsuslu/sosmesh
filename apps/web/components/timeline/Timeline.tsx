'use client';

import { useOperatorPreferences } from '../operator/OperatorPreferencesProvider';

type TimelineEntry = {
  id: string;
  deliveryState: string;
  source: string;
  createdAt: string;
};

type Props = {
  entries: TimelineEntry[];
  emptyMessage?: string;
};

function formatRelativeTime(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return locale === 'tr' ? 'Az önce' : 'Just now';
  if (diffMins < 60) return locale === 'tr' ? `${diffMins} dk önce` : `${diffMins}m ago`;
  if (diffHours < 24) return locale === 'tr' ? `${diffHours} sa önce` : `${diffHours}h ago`;
  return locale === 'tr' ? `${diffDays} gün önce` : `${diffDays}d ago`;
}

function getStateColor(state: string): string {
  const stateUpper = state.toUpperCase();
  if (stateUpper.includes('ACCEPT') || stateUpper.includes('SUCCESS')) return 'var(--color-status-success, #0a7)';
  if (stateUpper.includes('SEEN') || stateUpper.includes('VIEW')) return 'var(--color-info, #1976d2)';
  if (stateUpper.includes('PROGRESS') || stateUpper.includes('ASSIGN')) return 'var(--color-warning, #f59e0b)';
  if (stateUpper.includes('FAIL') || stateUpper.includes('ERROR')) return 'var(--color-danger, #dc2626)';
  return 'var(--color-text-secondary, #6b7280)';
}

export function Timeline({ entries, emptyMessage }: Props) {
  const { t, locale } = useOperatorPreferences();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  if (entries.length === 0) {
    return (
      <p className="timeline__empty">{emptyMessage || t('web.timeline.empty')}</p>
    );
  }

  const getStateLabel = (state: string): string => {
    const key = `web.deliveryStates.${state}`;
    const translated = t(key);
    return translated !== key ? translated : state.replace(/_/g, ' ');
  };

  const getSourceLabel = (source: string): string => {
    const key = `web.timeline.sources.${source}`;
    const translated = t(key);
    if (translated !== key) return translated;
    
    return source
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <ol className="timeline" data-testid="timeline">
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        const color = getStateColor(entry.deliveryState);
        const absoluteTime = new Date(entry.createdAt).toLocaleString(dateLocale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <li key={entry.id} className={`timeline__item ${isLast ? 'timeline__item--last' : ''}`}>
            <div className="timeline__marker" style={{ backgroundColor: color }} />
            <div className="timeline__content">
              <div className="timeline__title">{getStateLabel(entry.deliveryState)}</div>
              <div className="timeline__source">{getSourceLabel(entry.source)}</div>
              <time
                className="timeline__time"
                dateTime={entry.createdAt}
                title={absoluteTime}
              >
                {formatRelativeTime(entry.createdAt, locale)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
