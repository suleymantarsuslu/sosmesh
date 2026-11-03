export function StatCard({
  label,
  value,
  emptyHint,
  icon,
}: {
  label: string;
  value: number | null;
  emptyHint?: string;
  icon?: string;
}) {
  const hasValue = value !== null;
  return (
    <article className="ui-stat ui-stat--kpi" data-testid={`stat-${label}`}>
      <div className="ui-stat__head">
        {icon ? (
          <span className="ui-stat__icon" aria-hidden>
            {icon}
          </span>
        ) : null}
        <p className="ui-stat__label">{label}</p>
      </div>
      <p className="ui-stat__value" data-empty={hasValue ? 'false' : 'true'}>
        {hasValue ? String(value) : '—'}
      </p>
      {!hasValue && emptyHint ? (
        <p className="ui-stat__empty-hint">{emptyHint}</p>
      ) : null}
    </article>
  );
}
