import { redirect } from 'next/navigation';

import { canAccessOperatorAuditPage } from '../../../../../lib/operator-health-access';
import { fetchWithSession, readSession } from '../../../../../lib/session';

type AuditItem = {
  id: string;
  action: string;
  actorId: string | null;
  actorRole: string;
  incidentId: string | null;
  createdAt: string;
  details: unknown;
};

export default async function OperatorAuditPage() {
  const session = readSession();
  if (!session) {
    redirect('/operator/login?next=/operator/audit');
  }
  if (!canAccessOperatorAuditPage(session.role)) {
    redirect('/operator/denied');
  }

  const res = await fetchWithSession('/v1/operator/observability/audit');
  const body = res.ok ? ((await res.json()) as { items: AuditItem[] }) : { items: [] };

  return (
    <main data-testid="operator-audit-page">
      <h1>Denetim izi</h1>
      <p>Kim / ne / ne zaman — PII redakte.</p>
      <table>
        <thead>
          <tr>
            <th>Zaman</th>
            <th>Eylem</th>
            <th>Aktör</th>
            <th>Rol</th>
          </tr>
        </thead>
        <tbody>
          {body.items.map((row) => (
            <tr key={row.id} data-testid={`audit-row-${row.action}`}>
              <td>{row.createdAt}</td>
              <td>{row.action}</td>
              <td>{row.actorId ?? '—'}</td>
              <td>{row.actorRole}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
