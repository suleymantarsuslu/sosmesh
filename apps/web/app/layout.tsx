import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

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
import './(operator)/operator/(panel)/broadcasts/broadcasts.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

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
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning className={inter.variable}>
      <head>
        <link rel="stylesheet" href="/tokens.css" />
      </head>
      <body className={inter.className}>
        <OperatorPreferencesProvider>
          <ToastProvider>{children}</ToastProvider>
        </OperatorPreferencesProvider>
      </body>
    </html>
  );
}
