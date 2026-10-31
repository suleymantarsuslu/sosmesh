export function StatCard({
  label,
  value,
  emptyLabel,
}: {
  label: string;
  value: number | null;
  emptyLabel: string;
}) {
  const display = value === null ? emptyLabel : String(value);
  return (
    <article className="ui-stat" data-testid={`stat-${label}`}>
      <p className="ui-stat__label">{label}</p>
      <p className="ui-stat__value" data-empty={value === null ? 'true' : 'false'}>
        {display}
      </p>
    </article>
  );
}
