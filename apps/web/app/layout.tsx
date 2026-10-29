import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
