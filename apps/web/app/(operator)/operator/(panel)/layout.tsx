import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { OperatorShell } from '../../../../components/operator/OperatorShell';
import { readSession } from '../../../../lib/session';

export default function OperatorPanelLayout({ children }: { children: ReactNode }) {
  const session = readSession();
  if (!session) {
    redirect('/operator/login');
  }
  return (
    <OperatorShell
      user={{
        displayName: session.displayName,
        role: session.role,
        email: session.email,
      }}
    >
      {children}
    </OperatorShell>
  );
}
