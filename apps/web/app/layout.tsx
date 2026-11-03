import type { Metadata } from 'next';

import { OperatorPreferencesProvider } from '../components/operator/OperatorPreferencesProvider';
import { ToastProvider } from '../components/ui/ToastProvider';
import { translate, DEFAULT_LOCALE } from '../lib/i18n/operator-messages';

import './globals.css';
import './design-system.css';
import './operator.css';
import './marketing.css';

export const metadata: Metadata = {
  title: translate(DEFAULT_LOCALE, 'web.marketing.metaTitle'),
  description: translate(DEFAULT_LOCALE, 'web.marketing.metaDescription'),
  openGraph: {
    title: translate(DEFAULT_LOCALE, 'web.marketing.metaTitle'),
    description: translate(DEFAULT_LOCALE, 'web.marketing.metaDescription'),
    images: [{ url: '/brand/sosmesh-logo.png', alt: 'SOSMesh' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/tokens.css" />
      </head>
      <body>
        <OperatorPreferencesProvider>
          <ToastProvider>{children}</ToastProvider>
        </OperatorPreferencesProvider>
      </body>
    </html>
  );
}
