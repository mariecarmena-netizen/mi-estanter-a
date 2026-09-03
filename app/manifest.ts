import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mi Estantería — Tu diario de lectura',
    short_name: 'Mi Estantería',
    description:
      'Cronometra tus lecturas, registra tus páginas y llena tu propia estantería.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f0e8',
    theme_color: '#2e5945',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/app-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
