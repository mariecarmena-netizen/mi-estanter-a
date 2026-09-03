import type { Metadata } from 'next';

import './globals.css';

const configuredOrigin =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://mi-estanteria-lectura.mariecarmena.chatgpt.site');

export const metadata: Metadata = {
  metadataBase: new URL(configuredOrigin),
  title: 'Mi Estantería — Tu diario de lectura',
  description: 'Cronometra tus lecturas, registra tus páginas y llena tu estantería con cada libro terminado.',
  openGraph: {
    title: 'Mi Estantería',
    description: 'Tu diario de lectura: mide tu ritmo, registra tus páginas y llena tu propia estantería.',
    images: [{ url: '/og.png', width: 1730, height: 909, alt: 'Mi Estantería — Tu diario de lectura' }],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mi Estantería',
    description: 'Tu diario de lectura: mide tu ritmo, registra tus páginas y llena tu propia estantería.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
