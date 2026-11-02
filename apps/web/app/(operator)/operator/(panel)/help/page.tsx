import { redirect } from 'next/navigation';

import { HelpView } from '../../../../../features/help/HelpView';
import { readSession } from '../../../../../lib/session';

export default async function OperatorHelpPage() {
  const session = await readSession();
  if (!session) {
    redirect('/operator/login?next=/operator/help');
  }

  return <HelpView />;
}
