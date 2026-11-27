import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IRB® Academia',
    short_name: 'IRB®',
    description: 'Prácticas y cursos de IRB® con Ximena Duque Valencia',
    start_url: '/',
    display: 'standalone',
    background_color: '#07061f',
    theme_color: '#07061f',
    lang: 'es',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
