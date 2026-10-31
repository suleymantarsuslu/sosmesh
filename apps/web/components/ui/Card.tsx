import type { ReactNode } from 'react';

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ui-card ${className}`.trim()}>
      {title ? <h2 className="ui-card__title">{title}</h2> : null}
      {children}
    </section>
  );
}
