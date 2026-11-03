'use client';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { OperatorCaseRow } from './types';

type Props = {
  rows: OperatorCaseRow[];
  selectedId: string | null;
  onSelect: (incidentId: string) => void;
};

/** Screen-reader oriented full data table (map is visual primary). */
export function CasesAccessibleTable({ rows, selectedId, onSelect }: Props) {
  const { t, locale } = useOperatorPreferences();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  return (
    <div className="cases-a11y-table-wrap">
      <ul className="cases-mobile-cards" data-testid="cases-mobile-cards">
        {rows.length === 0 ? (
          <li className="cases-mobile-cards__empty">{t('web.cases.tableEmpty')}</li>
        ) : (
          rows.map((row) => (
            <li key={row.incidentId}>
              <button
                type="button"
                className={
                  selectedId === row.incidentId
                    ? 'cases-mobile-cards__item cases-mobile-cards__item--active'
                    : 'cases-mobile-cards__item'
                }
                onClick={() => onSelect(row.incidentId)}
                aria-label={t('web.cases.selectCase').replace('{{id}}', row.incidentId.slice(0, 8))}
              >
                <p className="cases-mobile-cards__title">{row.incidentId.slice(0, 8)}…</p>
                <dl className="cases-mobile-cards__meta">
                  <div>
                    <dt>{t('web.cases.tableHeaders.category')}</dt>
                    <dd>{row.sosType}</dd>
                  </div>
                  <div>
                    <dt>{t('web.cases.tableHeaders.priority')}</dt>
                    <dd>P{row.priority}</dd>
                  </div>
                  <div>
                    <dt>{t('web.cases.tableHeaders.locationStatus')}</dt>
                    <dd>{row.locationStatus}</dd>
                  </div>
                  <div>
                    <dt>{t('web.cases.tableHeaders.received')}</dt>
                    <dd>{new Date(row.receivedAt).toLocaleString(dateLocale)}</dd>
                  </div>
                </dl>
              </button>
            </li>
          ))
        )}
      </ul>
      <table className="cases-a11y-table cases-a11y-table--modern" data-testid="cases-a11y-table">
        <caption>{t('web.cases.tableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('web.cases.tableHeaders.case')}</th>
            <th scope="col">{t('web.cases.tableHeaders.category')}</th>
            <th scope="col">{t('web.cases.tableHeaders.priority')}</th>
            <th scope="col">{t('web.cases.tableHeaders.locationStatus')}</th>
            <th scope="col">{t('web.cases.tableHeaders.latitude')}</th>
            <th scope="col">{t('web.cases.tableHeaders.longitude')}</th>
            <th scope="col">{t('web.cases.tableHeaders.accuracy')}</th>
            <th scope="col">{t('web.cases.tableHeaders.received')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8}>{t('web.cases.tableEmpty')}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.incidentId}
                onClick={() => onSelect(row.incidentId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(row.incidentId);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={t('web.cases.selectCase').replace('{{id}}', row.incidentId.slice(0, 8))}
                className={selectedId === row.incidentId ? 'cases-a11y-table__row--active' : ''}
                data-testid={`case-table-row-${row.incidentId.slice(0, 8)}`}
              >
                <td>{row.incidentId.slice(0, 8)}</td>
                <td>{row.sosType}</td>
                <td>P{row.priority}</td>
                <td>{row.locationStatus}</td>
                <td>{row.latitude?.toFixed(4) ?? '—'}</td>
                <td>{row.longitude?.toFixed(4) ?? '—'}</td>
                <td>{row.accuracyMeters ?? '—'}</td>
                <td>{new Date(row.receivedAt).toLocaleString(dateLocale)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
