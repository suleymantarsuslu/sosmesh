'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import { Icon, type IconName } from '../cases/detail/icons';

export type OpsTone = 'ok' | 'warn' | 'danger' | 'info' | 'muted' | 'ai';

/** Page header used by the modernized operator pages (icon tile, title, subtitle, actions). */
export function OpsHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="ops-header">
      <span className="ops-header__icon" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className="ops-header__text">
        <h1 className="ops-header__title">{title}</h1>
        {subtitle ? <p className="ops-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ops-header__actions">{actions}</div> : null}
    </header>
  );
}

export function OpsChip({
  tone = 'muted',
  icon,
  children,
  title,
  testId,
}: {
  tone?: OpsTone;
  icon?: IconName;
  children: ReactNode;
  title?: string;
  testId?: string;
}) {
  return (
    <span className={`ops-chip ops-chip--${tone}`} title={title} data-testid={testId}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

/** Toggle chip used for status/type filters, with an optional count. */
export function OpsFilterChip({
  active,
  onClick,
  children,
  count,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  testId?: string;
}) {
  return (
    <button
      type="button"
      className={`ops-filter-chip${active ? ' is-on' : ''}`}
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
      {count !== undefined ? <span className="ops-filter-chip__count">{count}</span> : null}
    </button>
  );
}

export function OpsSearch({
  value,
  onChange,
  placeholder,
  label,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  label: string;
  testId?: string;
}) {
  return (
    <label className="ops-search">
      <span className="cd2-sr-only">{label}</span>
      <Icon name="search" size={16} />
      <input
        type="search"
        className="ops-search__input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId}
      />
    </label>
  );
}

export function OpsEmpty({
  icon,
  title,
  hint,
  action,
  testId,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="ops-empty" data-testid={testId}>
      <span className="ops-empty__icon" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <p className="ops-empty__title">{title}</p>
      {hint ? <p className="ops-empty__hint">{hint}</p> : null}
      {action}
    </div>
  );
}

/** Loading / error / empty shell. Keeps the screen-state-* test ids of the design-system ScreenState. */
export function OpsState({
  state,
  icon,
  emptyTitle,
  emptyHint,
  children,
}: {
  state: 'idle' | 'loading' | 'error' | 'empty';
  icon: IconName;
  emptyTitle?: string;
  emptyHint?: string;
  children: ReactNode;
}) {
  const { t } = useOperatorPreferences();
  const router = useRouter();

  if (state === 'loading') {
    return (
      <div data-testid="screen-state-loading" aria-busy="true" className="ops-skeleton-grid">
        <p className="cd2-sr-only">{t('states.loading')}</p>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="cd2-card ops-skeleton-card" aria-hidden="true">
            <div className="cd2-skeleton">
              <span />
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div data-testid="screen-state-error" role="alert" className="ops-error">
        <span className="ops-error__icon" aria-hidden="true">
          <Icon name="alert" size={22} />
        </span>
        <p className="ops-error__text">{t('states.error')}</p>
        <button type="button" className="cd2-btn" onClick={() => router.refresh()}>
          <Icon name="refresh" size={14} />
          {t('common.retry')}
        </button>
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <OpsEmpty
        testId="screen-state-empty"
        icon={icon}
        title={emptyTitle ?? t('states.empty')}
        hint={emptyHint}
      />
    );
  }
  return <>{children}</>;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return `${first}${last}`.toUpperCase();
}
