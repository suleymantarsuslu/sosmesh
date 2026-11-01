import type { Metadata } from 'next';

import { ToastProvider } from '../components/ui/ToastProvider';
import './globals.css';
import './design-system.css';
import './operator.css';

export const metadata: Metadata = {
  title: 'SOSMesh Operator Dashboard',
  description: 'Emergency mesh network operator dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="stylesheet" href="/tokens.css" />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
