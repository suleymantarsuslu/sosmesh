'use client';

import type { OperatorCaseRow } from './types';

type Props = {
  rows: OperatorCaseRow[];
  selectedId: string | null;
  onSelect: (incidentId: string) => void;
};

export function UnknownLocationQueue({ rows, selectedId, onSelect }: Props) {
  return (
    <section
      className="unknown-location-queue"
      aria-label="Konumu bilinmeyen vakalar"
      data-testid="unknown-location-queue"
    >
      <h2>Konum bilinmiyor ({rows.length})</h2>
      <p className="unknown-location-queue__hint">
        Koordinatı olmayan vakalar haritaya pinlenmez (0,0 kullanılmaz).
      </p>
      <ul>
        {rows.map((row) => (
          <li key={row.incidentId}>
            <button
              type="button"
              className={
                selectedId === row.incidentId
                  ? 'unknown-location-queue__item unknown-location-queue__item--active'
                  : 'unknown-location-queue__item'
              }
              onClick={() => onSelect(row.incidentId)}
              data-testid={`unknown-queue-item-${row.incidentId.slice(0, 8)}`}
            >
              <span>{row.messageId.slice(0, 8)}…</span>
              <span>{row.locationStatus}</span>
              <span>P{row.priority}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
