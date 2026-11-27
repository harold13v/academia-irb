'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, MotionConfig } from 'motion/react';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { LiveProvider } from './live';

const loadFeatures = () => import('@/lib/motion-features').then((m) => m.default);

/** Las recompensas no viajan en la carga inicial: se descargan con el primer XP que llega por SSE. */
function LazyRewards() {
  const [R, setR] = useState<null | { C: typeof import('./rewards').Rewards; first: unknown }>(null);
  useEffect(() => {
    const on = (e: Event) => {
      window.removeEventListener('irb:delta', on);
      // el primer delta se entrega como prop: el componente aún no escuchaba cuando llegó
      void import('./rewards').then((m) => setR({ C: m.Rewards, first: (e as CustomEvent).detail }));
    };
    window.addEventListener('irb:delta', on);
    return () => window.removeEventListener('irb:delta', on);
  }, []);
  return R ? <R.C first={R.first as never} /> : null;
}

/** PWA: el service worker se registra cuando el navegador está libre, sin competir con la carga. */
function useServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    const reg = () => void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    const idle = () => ('requestIdleCallback' in window ? window.requestIdleCallback(reg, { timeout: 3000 }) : setTimeout(reg, 1));
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  useServiceWorker();
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false }, mutations: { retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      <LazyMotion features={loadFeatures} strict>
        <MotionConfig reducedMotion="user">
          <LiveProvider>
            {children}
            <LazyRewards />
          </LiveProvider>
        </MotionConfig>
      </LazyMotion>
      <Toaster position="bottom-center" offset={24} mobileOffset={{ bottom: 96 }} theme="dark" toastOptions={{ style: { background: 'var(--sin-inverse-surface)', color: 'var(--sin-inverse-on-surface)', border: 0, borderRadius: 12, font: '600 14px/20px var(--font-text)' } }} />
    </QueryClientProvider>
  );
}
