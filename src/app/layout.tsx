import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { Atmosphere } from '@/components/rayo/atmosphere';
import './globals.css';
import './v3.css';
import './rayo.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_URL ?? 'https://staging-academia.irbximena.com'),
  title: { default: 'IRB® · Academia', template: '%s | IRB®' },
  description: 'Prácticas y cursos de IRB® Indigo Ray Balancing con Ximena Duque Valencia.',
  robots: { index: false, follow: false, nocache: true },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-180.png' },
  appleWebApp: { capable: true, title: 'IRB®', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { themeColor: '#05041a', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="irb-dark" suppressHydrationWarning>
      <head>
        {/* la entrada orquestada solo corre en la primera carga de la sesión */}
        <script dangerouslySetInnerHTML={{ __html: "try{sessionStorage.getItem('irb-entered')?document.documentElement.dataset.entered='1':sessionStorage.setItem('irb-entered','1')}catch(e){}" }} />
        <link rel="preload" href="/fonts/material-symbols-rounded.woff2" as="font" type="font/woff2" crossOrigin="" />
        {/* tipografía editorial de irbximena.com/v2: Bodoni Moda (titulares) + Hanken Grotesk (texto) */}
        <link rel="preload" href="/fonts/hanken-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/bodoni-moda-latin-opsz-normal.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <Atmosphere />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
