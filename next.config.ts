import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const withSerwist = withSerwistInit({ swSrc: 'src/app/sw.ts', swDest: 'public/sw.js', register: false, exclude: [/%5Fdesign/, /\.map$/], disable: process.env.NODE_ENV !== 'production' });

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://player.vimeo.com https://w.soundcloud.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://indigoacademy.digital https://i.vimeocdn.com https://i1.sndcdn.com https://i.ytimg.com",
  "media-src 'self' https://*.vimeocdn.com",
  "frame-src https://player.vimeo.com https://w.soundcloud.com https://www.youtube-nocookie.com https://open.spotify.com https://docs.google.com https://drive.google.com",
  "connect-src 'self' https://*.vimeo.com https://*.vimeocdn.com https://*.sentry.io",
  "font-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'indigoacademy.digital', pathname: '/wp-content/uploads/**' },
      { protocol: 'https', hostname: 'i.vimeocdn.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
  },
  experimental: { optimizePackageImports: ['@radix-ui/react-tabs', '@radix-ui/react-dialog'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
};

export default withSerwist(config);
