import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { OperatorShell } from '../../../../components/operator/OperatorShell';
import { isE2eMock } from '../../../../lib/config';
import { readSession } from '../../../../lib/session';

export default function OperatorPanelLayout({ children }: { children: ReactNode }) {
  const session = readSession();
  if (!session) {
    redirect('/operator/login');
  }
  return (
    <OperatorShell
      demoMode={isE2eMock()}
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
