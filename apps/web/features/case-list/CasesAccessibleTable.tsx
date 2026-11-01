'use client';

import type { OperatorCaseRow } from './types';

type Props = {
  rows: OperatorCaseRow[];
};

/** Screen-reader oriented full data table (map is visual primary). */
export function CasesAccessibleTable({ rows }: Props) {
  return (
    <table className="cases-a11y-table" data-testid="cases-a11y-table">
      <caption>Canlı SOS vaka tablosu (ekran okuyucu)</caption>
      <thead>
        <tr>
          <th scope="col">Vaka</th>
          <th scope="col">Kategori</th>
          <th scope="col">Öncelik</th>
          <th scope="col">Konum durumu</th>
          <th scope="col">Enlem</th>
          <th scope="col">Boylam</th>
          <th scope="col">Doğruluk (m)</th>
          <th scope="col">Alınma</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={8}>Kayıt yok</td>
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
              <td>{new Date(row.receivedAt).toLocaleString('tr-TR')}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
