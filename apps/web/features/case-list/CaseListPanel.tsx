'use client';

import type { OperatorCaseRow } from './types';

type Props = {
  rows: OperatorCaseRow[];
  selectedId: string | null;
  onSelect: (incidentId: string) => void;
};

export function CaseListPanel({ rows, selectedId, onSelect }: Props) {
  return (
    <section className="case-list-panel" aria-label="Konumlu vakalar" data-testid="case-list-panel">
      <h2>Konumlu vakalar ({rows.length})</h2>
      <ul className="case-list-panel__list">
        {rows.length === 0 ? (
          <li className="case-list-panel__empty">Filtreye uyan konumlu vaka yok</li>
        ) : (
          rows.map((row) => (
            <li key={row.incidentId}>
              <button
                type="button"
                className={
                  selectedId === row.incidentId
                    ? 'case-list-panel__item case-list-panel__item--active'
                    : 'case-list-panel__item'
                }
                onClick={() => onSelect(row.incidentId)}
                data-testid={`case-list-item-${row.incidentId.slice(0, 8)}`}
              >
                <span className="case-list-panel__priority">P{row.priority}</span>
                <span>{row.sosType}</span>
                <span>{row.deliveryState}</span>
                <time dateTime={row.receivedAt}>
                  {new Date(row.receivedAt).toLocaleString('tr-TR')}
                </time>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
