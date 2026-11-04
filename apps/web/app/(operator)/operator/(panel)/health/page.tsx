import { redirect } from 'next/navigation';

import { HealthView } from '../../../../../features/health/HealthView';
import { loadHealthSnapshot } from '../../../../../lib/health-snapshot';
import { canAccessOperatorHealthPage } from '../../../../../lib/operator-health-access';
import { readSession } from '../../../../../lib/session';

export const dynamic = 'force-dynamic';

export default async function OperatorHealthPage() {
  const session = await readSession();
  if (!session) {
    redirect('/operator/login?next=/operator/health');
  }
  if (!canAccessOperatorHealthPage(session.role)) {
    redirect('/operator/denied');
  }

  const initial = await loadHealthSnapshot();
  return <HealthView initial={initial} />;
}
