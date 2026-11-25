import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-jakarta', display: 'swap' });
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-bricolage', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_URL ?? 'https://staging-academia.irbximena.com'),
  title: { default: 'IRB® · Academia', template: '%s | IRB®' },
  description: 'Prácticas y cursos de IRB® Indigo Ray Balancing con Ximena Duque Valencia.',
  robots: { index: false, follow: false, nocache: true },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon.svg', apple: '/icons/apple-180.png' },
  appleWebApp: { capable: true, title: 'IRB®', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { themeColor: '#12132b', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="irb-dark" suppressHydrationWarning className={`${jakarta.variable} ${bricolage.variable}`}>
      <head>
        {/* la entrada orquestada solo corre en la primera carga de la sesión */}
        <script dangerouslySetInnerHTML={{ __html: "try{sessionStorage.getItem('irb-entered')?document.documentElement.dataset.entered='1':sessionStorage.setItem('irb-entered','1')}catch(e){}" }} />
        <link rel="preload" href="/fonts/material-symbols-rounded.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
