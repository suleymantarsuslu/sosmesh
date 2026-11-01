import type { ReactNode } from 'react';

export function BentoCard({
  title,
  children,
  span = 1,
  testId,
}: {
  title: string;
  children: ReactNode;
  span?: 1 | 2;
  testId?: string;
}) {
  return (
    <article
      className={`ds-bento-card ds-bento-card--span-${span}`}
      data-testid={testId}
    >
      <h3 className="ds-bento-card__title">{title}</h3>
      <div className="ds-bento-card__body">{children}</div>
    </article>
  );
}

export function BentoGrid({ children }: { children: ReactNode }) {
  return <div className="ds-bento-grid">{children}</div>;
}
