'use client';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { OperatorCaseRow } from './types';

type Props = {
  rows: OperatorCaseRow[];
};

/** Screen-reader oriented full data table (map is visual primary). */
export function CasesAccessibleTable({ rows }: Props) {
  const { t, locale } = useOperatorPreferences();
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  return (
    <div className="cases-a11y-table-wrap">
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
              <tr key={row.incidentId}>
                <td>{row.incidentId.slice(0, 8)}</td>
                <td>{row.sosType}</td>
                <td>{row.priority}</td>
                <td>{row.locationStatus}</td>
                <td>{row.latitude ?? '—'}</td>
                <td>{row.longitude ?? '—'}</td>
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
