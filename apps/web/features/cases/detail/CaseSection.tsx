import type { ReactNode } from 'react';

import { Icon, type IconName } from './icons';

type Props = {
  title: string;
  icon: IconName;
  children: ReactNode;
  actions?: ReactNode;
  testId?: string;
  className?: string;
  /** Visually hide the title (still available to assistive tech). */
  titleId?: string;
};

export function CaseSection({ title, icon, children, actions, testId, className = '', titleId }: Props) {
  return (
    <section className={`cd2-card ${className}`.trim()} data-testid={testId} aria-labelledby={titleId}>
      <header className="cd2-card__header">
        <span className="cd2-card__icon">
          <Icon name={icon} size={16} />
        </span>
        <h2 className="cd2-card__title" id={titleId}>
          {title}
        </h2>
        {actions ? <div className="cd2-card__actions">{actions}</div> : null}
      </header>
      <div className="cd2-card__body">{children}</div>
    </section>
  );
}
