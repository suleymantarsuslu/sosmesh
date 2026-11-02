import { redirect } from 'next/navigation';

import { readSession } from '../../../../../lib/session';

export default async function OperatorAdminPage() {
  const session = await readSession();
  if (!session) {
    redirect('/operator/login?next=/operator/admin');
  }
  if (session.role !== 'ADMIN') {
    redirect('/operator/denied');
  }

  return (
    <>
      <h1>Yönetim</h1>
      <p>Yalnızca yönetici rolü bu alana erişebilir.</p>
    </>
  );
}
