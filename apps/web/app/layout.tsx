import type { Metadata } from 'next';

import { OperatorPreferencesProvider } from '../components/operator/OperatorPreferencesProvider';
import { ToastProvider } from '../components/ui/ToastProvider';
import { translate, DEFAULT_LOCALE } from '../lib/i18n/operator-messages';

import './globals.css';
import './design-system.css';
import './operator.css';
import './marketing.css';
import './ai.css';
import './cases-modern.css';
import './case-detail-v2.css';
import './ops-pages.css';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
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
