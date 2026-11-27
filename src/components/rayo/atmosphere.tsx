'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { createRay, type RayState } from './ray';

/**
 * Atmósfera de irbximena.com/v2 llevada a la Academia: un solo componente, montado una vez en el layout raíz.
 * - Rayo índigo (WebGL) de fondo: animado en inicio, cursos y perfil; quieto (un solo cuadro) dentro de las clases,
 *   para que el video no compita con la GPU; a pleno en /entrar.
 * - Cursor anillo + punto (solo con mouse), que crece sobre enlaces y muestra "Ver" sobre portadas.
 * - Barra de espectro: avance del scroll de la página y barrido al navegar.
 * - Foco de luz dorado bajo el cursor en las cards y botones magnéticos en las acciones principales.
 * Todo respeta prefers-reduced-motion y se detiene con la pestaña oculta.
 */

type Mode = 'hero' | 'calm' | 'still';
const modeOf = (path: string): Mode => {
  if (path === '/entrar') return 'hero';
  if (/^\/cursos\/[^/]+\/[^/]+/.test(path) || path.startsWith('/practicas/') || path.startsWith('/fuegos')) return 'still';
  return 'calm';
};
// objetivo de cada modo: intensidad del haz, oscurecimiento (para leer encima) y "amor" de base
const TARGET: Record<Mode, { beam: number; dim: number; love: number }> = {
  hero: { beam: 1, dim: 0, love: 0.18 },
  calm: { beam: 0.3, dim: 0.42, love: 0 },
  still: { beam: 0.2, dim: 0.62, love: 0.05 },
};

const MEDIA = '.hx-art, .thumb, .cover-16x9, .course-hero .media-glow, [data-cursor]';
const LINK = 'a, button, [role="button"], [role="tab"], label, select, summary';
const SPOT = '.card.interactive, .goal-card, .stat, .medal, .fam-cta';
const MAGNET = '.btn.primary.lg, .hx-play, .big-play, [data-magnetic]';

export function Atmosphere() {
  const path = usePathname();
  const canvas = useRef<HTMLCanvasElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const prog = useRef<HTMLDivElement>(null);
  const sweep = useRef<HTMLDivElement>(null);
  const api = useRef<{ setMode: (m: Mode) => void; flash: () => void } | null>(null);

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const root = document.documentElement;
    const cv = canvas.current!;
    const ray = createRay(cv, coarse);
    if (ray) root.dataset.ray = 'on';

    let mode: Mode = modeOf(location.pathname);
    // sin mouse, el haz descansa hacia el borde derecho para no cruzar el texto
    const restX = coarse ? 0.86 : 0.5;
    const s: RayState = { love: TARGET[mode].love, beam: TARGET[mode].beam, flash: 0, dim: TARGET[mode].dim, mx: restX, my: 0.55 };
    let tmx = restX,
      tmy = 0.55,
      scroll = 0,
      flashT = 0,
      raf = 0,
      still = 0;
    const t0 = performance.now();
    const animated = () => !reduce && !saveData && mode !== 'still';

    /* ---------- loop único: rayo + cursor ---------- */
    let cx = innerWidth / 2,
      cy = innerHeight / 2,
      px = cx,
      py = cy;
    const cursorOn = !coarse && !reduce;
    const frame = (now: number) => {
      raf = 0;
      if (document.hidden) return;
      const tg = TARGET[mode];
      const k = animated() ? 0.05 : 1;
      s.mx += (tmx - s.mx) * (animated() ? 0.045 : 1);
      s.my += (tmy - s.my) * (animated() ? 0.045 : 1);
      s.beam += (tg.beam - s.beam) * k;
      s.dim += (tg.dim - s.dim) * k;
      s.love += (Math.max(tg.love, Math.min(1, scroll * 1.1) * 0.8) - s.love) * k;
      if (flashT) {
        const e = (now - flashT) / 700;
        s.flash = e >= 1 ? ((flashT = 0), 0) : Math.sin(e * Math.PI) * 0.09;
      }
      if (ray) ray.draw(now, animated() ? (now - t0) / 1000 : 8, s);
      if (cursorOn && ring.current) {
        px += (cx - px) * 0.18;
        py += (cy - py) * 0.18;
        ring.current.style.transform = `translate3d(${px}px,${py}px,0)`;
        dot.current!.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      }
      // en modo quieto se dibuja un par de cuadros y se detiene: cero costo mientras corre el video
      const moving = animated() || flashT || (cursorOn && Math.abs(cx - px) + Math.abs(cy - py) > 0.5);
      if (moving) still = 0;
      else still++;
      if (still < 3) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      still = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    };

    api.current = {
      setMode(m) {
        mode = m;
        kick();
      },
      flash() {
        if (reduce) return;
        flashT = performance.now();
        kick();
      },
    };

    /* ---------- eventos ---------- */
    const onMove = (e: PointerEvent) => {
      cx = e.clientX;
      cy = e.clientY;
      if (e.pointerType === 'mouse') {
        tmx = cx / innerWidth;
        tmy = 1 - cy / innerHeight;
      }
      if (ring.current) ring.current.dataset.hidden = 'false';
      // foco de luz: la card toma la posición del cursor
      const sp = (e.target as Element).closest?.(SPOT) as HTMLElement | null;
      if (sp) {
        const r = sp.getBoundingClientRect();
        sp.style.setProperty('--mx', `${e.clientX - r.left}px`);
        sp.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
      kick();
    };
    const onOver = (e: PointerEvent) => {
      if (!ring.current) return;
      const t = e.target as Element;
      const media = t.closest?.(MEDIA) as HTMLElement | null;
      const vid = t.closest?.('.vcard, iframe, input, textarea, [contenteditable="true"]');
      ring.current.dataset.state = vid ? 'hide' : media ? 'media' : t.closest?.(LINK) ? 'link' : '';
      label.current!.textContent = media ? (media.dataset.cursor ?? 'Ver') : '';
    };
    const onLeave = (e: PointerEvent) => {
      // el puntero entró a un iframe (video) o salió de la ventana: el anillo se esconde en vez de quedarse congelado
      if (!e.relatedTarget && ring.current) ring.current.dataset.hidden = 'true';
    };

    /* scroll: contenedor del shell en escritorio, ventana en móvil */
    const onScroll = () => {
      const main = document.getElementById('main');
      const el = main && main.scrollHeight > main.clientHeight + 4 ? main : document.scrollingElement!;
      const max = el.scrollHeight - el.clientHeight;
      scroll = max > 0 ? el.scrollTop / max : 0;
      if (prog.current) prog.current.style.transform = `scaleX(${scroll.toFixed(4)})`;
      kick();
    };

    /* botones magnéticos: se inclinan hacia el cursor (propiedad translate, no pisa los transform del hover) */
    let mag: HTMLElement | null = null;
    const onMagnet = (e: PointerEvent) => {
      const b = (e.target as Element).closest?.(MAGNET) as HTMLElement | null;
      if (mag && mag !== b) {
        mag.style.translate = '';
        mag = null;
      }
      if (!b) return;
      mag = b;
      const r = b.getBoundingClientRect();
      b.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1)}px`;
    };

    /* barrido de espectro al navegar: arranca con el clic, termina cuando cambia la ruta */
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      sweep.current?.setAttribute('data-state', 'run');
    };

    const onVis = () => {
      if (!document.hidden) {
        ray?.resetClock();
        kick();
      }
    };
    const onResize = () => {
      ray?.resize();
      kick();
    };

    addEventListener('pointermove', onMove, { passive: true });
    if (cursorOn) {
      addEventListener('pointerover', onOver, { passive: true });
      document.addEventListener('pointerout', onLeave, { passive: true });
      addEventListener('pointermove', onMagnet, { passive: true });
    }
    addEventListener('scroll', onScroll, { passive: true, capture: true });
    addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('click', onClick, true);
    onScroll();
    kick();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onLeave);
      removeEventListener('pointermove', onMagnet);
      removeEventListener('scroll', onScroll, { capture: true });
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('click', onClick, true);
      ray?.lose();
      delete root.dataset.ray;
    };
  }, []);

  // cada cambio de ruta: el rayo cambia de modo y destella; el barrido de navegación termina
  useEffect(() => {
    api.current?.setMode(modeOf(path));
    api.current?.flash();
    const sw = sweep.current;
    if (sw?.dataset.state === 'run') {
      sw.dataset.state = 'done';
      const t = setTimeout(() => sw.removeAttribute('data-state'), 600);
      return () => clearTimeout(t);
    }
  }, [path]);

  return (
    <>
      <canvas ref={canvas} className="rayo-bg" aria-hidden="true" />
      <div className="rayo-progress" aria-hidden="true">
        <div ref={prog} />
      </div>
      <div ref={sweep} className="rayo-sweep" aria-hidden="true" />
      <div ref={ring} className="rayo-cursor" data-hidden="true" aria-hidden="true">
        <span ref={label} />
      </div>
      <div ref={dot} className="rayo-dot" aria-hidden="true" />
    </>
  );
}
