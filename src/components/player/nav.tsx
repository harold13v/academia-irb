'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { track } from '@/server/actions';

/* ───────────── navegación entre clases con View Transitions (mejora progresiva) ───────────── */

export function useLessonNav() {
  const router = useRouter();
  return (href: string) => {
    const doc = document as Document & { startViewTransition?: (cb: () => Promise<void> | void) => unknown };
    if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return router.push(href, { scroll: false });
    doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          router.push(href, { scroll: false });
          const t0 = location.pathname;
          const check = () => (location.pathname !== t0 ? resolve() : requestAnimationFrame(check));
          requestAnimationFrame(check);
          setTimeout(resolve, 600);
        }),
    );
  };
}

export function LessonLink({ href, className, children, onClick, ...rest }: { href: string; className?: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const go = useLessonNav();
  return (
    <Link
      {...rest}
      href={href}
      scroll={false}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(href);
      }}
    >
      {children}
    </Link>
  );
}

/* ───────────── evento en vivo de FAM 2027: el enlace al embudo NO cambia (mismo href + query del visitante) ───────────── */

export const EVENT = { title: 'Del miedo a la creación', at: Date.UTC(2026, 11, 2, 0, 0, 0), href: 'https://irbximena.com/pg/fam2027/org/' };

export function daysLeft() {
  const d = Math.ceil((EVENT.at - Date.now()) / 86_400_000);
  if (d > 1) return `Faltan ${d} días`;
  if (d === 1) return 'Es mañana';
  return EVENT.at - Date.now() > -3 * 3_600_000 ? 'Es hoy' : '';
}

export function useRegHref() {
  const [href, setHref] = useState(EVENT.href);
  useEffect(() => setHref(EVENT.href + (location.search || '')), []);
  return href;
}

export const trackReg = () => void track('fuegos_click_registro');

export function ics() {
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IRB//Fuegos//ES', 'BEGIN:VEVENT', 'UID:fam2027@irbximena.com', 'DTSTAMP:20261124T000000Z',
    'DTSTART:20261202T000000Z', 'DTEND:20261202T020000Z', 'SUMMARY:Del miedo a la creación · en vivo con Ximena Duque Valencia',
    'DESCRIPTION:En vivo por Zoom. Reserva tu lugar en https://irbximena.com/pg/fam2027/org/', 'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY',
    'DESCRIPTION:En 1 hora empieza Del miedo a la creación', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
  a.download = 'del-miedo-a-la-creacion.ics';
  a.click();
  void track('fuegos_calendario');
}
