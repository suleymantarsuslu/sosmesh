import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { LiveFeedProvider } from '../../../../components/operator/LiveFeedProvider';
import { OperatorShell } from '../../../../components/operator/OperatorShell';
import { shouldShowDemoModeBanner } from '../../../../lib/demo-mode';
import { readSession } from '../../../../lib/session';

export default async function OperatorPanelLayout({ children }: { children: ReactNode }) {
  const session = await readSession();
  if (!session) {
    redirect('/operator/login');
  }
  return (
    <LiveFeedProvider>
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
    </LiveFeedProvider>
  );
}
