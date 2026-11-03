import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SOSMesh Operator Dashboard',
    short_name: 'SOSMesh',
    description: 'Emergency mesh network operator dashboard',
    start_url: '/operator/login',
    display: 'standalone',
    background_color: '#070D1D',
    theme_color: '#070D1D',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
