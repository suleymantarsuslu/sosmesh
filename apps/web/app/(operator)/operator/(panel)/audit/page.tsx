import { redirect } from 'next/navigation';

import { canAccessOperatorAuditPage } from '../../../../../lib/operator-health-access';
import { fetchWithSession, readSession } from '../../../../../lib/session';

import { AuditView, type AuditItem } from './AuditView';

export default async function OperatorAuditPage() {
  const session = await readSession();
  if (!session) {
    redirect('/operator/login?next=/operator/audit');
  }
  if (!canAccessOperatorAuditPage(session.role)) {
    redirect('/operator/denied');
  }

  const res = await fetchWithSession('/v1/operator/observability/audit');
  const body = res.ok ? ((await res.json()) as { items: AuditItem[] }) : { items: [] };

  return <AuditView items={body.items} error={!res.ok} />;
}
