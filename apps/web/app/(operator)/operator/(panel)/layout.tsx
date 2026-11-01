import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { OperatorPreferencesProvider } from '../../../../components/operator/OperatorPreferencesProvider';
import { OperatorShell } from '../../../../components/operator/OperatorShell';
import { shouldShowDemoModeBanner } from '../../../../lib/demo-mode';
import { readSession } from '../../../../lib/session';

export default function OperatorPanelLayout({ children }: { children: ReactNode }) {
  const session = readSession();
  if (!session) {
    redirect('/operator/login');
  }
  return (
    <OperatorPreferencesProvider>
      <OperatorShell
        demoMode={shouldShowDemoModeBanner()}
        user={{
          displayName: session.displayName,
          role: session.role,
          email: session.email,
        }}
      >
        {children}
      </OperatorShell>
    </OperatorPreferencesProvider>
  );
}
