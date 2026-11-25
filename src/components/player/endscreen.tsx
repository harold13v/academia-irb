'use client';

import { m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { bowl, haptic } from '@/lib/feedback';
import { track } from '@/server/actions';
import type { Delta } from '../live';
import { Icon, Lotus, btn } from '../sin/ui';
import { useLessonCtx } from '../lesson/context';
import { EVENT, LessonLink, trackReg, useLessonNav, useRegHref } from './nav';

const COUNT = 8;
const BIG_DAYS = new Set([3, 7, 21]);
const AUTOSTART = 'irb-autostart';

/** Celebración: suave siempre; con loto y destellos en los días 3, 7 y 21. */
function Celebration({ big }: { big: boolean }) {
  if (!big) return null;
  const dots = Array.from({ length: 14 }, (_, i) => i);
  const tones = ['primary', 'secondary', 'tertiary', 'primary-fixed'];
  return (
    <div className="celebrate" aria-hidden="true">
      {dots.map((i) => {
        const a = (i / dots.length) * Math.PI * 2;
        return (
          <m.i
            key={i}
            style={{ background: `var(--sin-${tones[i % tones.length]})` }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x: Math.cos(a) * 160, y: Math.sin(a) * 110, opacity: [0, 1, 0], scale: 1 }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          />
        );
      })}
    </div>
  );
}

/** Fin de clase dentro de la tarjeta de video: celebración + cuenta regresiva de 8 s ("Detener").
 *  Sin autoplay después de meditaciones guiadas (lessons.autoplay_next = false). */
export function EndScreen({ soundOn, onReplay, onAdvance }: { soundOn: boolean; onReplay: () => void; onAdvance?: () => void }) {
  const { lesson, setClosing } = useLessonCtx();
  const [delta, setDelta] = useState<Delta | null>(null);
  const auto = !!lesson.next && lesson.autoplayNext && lesson.kind === 'course';
  const [left, setLeft] = useState(auto ? COUNT : -1);
  const go = useLessonNav();
  const regHref = useRegHref();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    haptic();
    if (soundOn) bowl();
    void track(lesson.kind === 'practice' ? 'fuegos_completado' : 'lesson_closing');
    const on = (e: Event) => setDelta((e as CustomEvent<Delta>).detail);
    window.addEventListener('irb:delta', on);
    return () => window.removeEventListener('irb:delta', on);
  }, [lesson.kind, soundOn]);

  // después de la primera práctica: ofrecer recordatorio (lo decide el reproductor, una sola vez)
  useEffect(() => {
    if (!delta || delta.gained <= 0) return;
    const t = setTimeout(() => window.dispatchEvent(new CustomEvent('irb:practice-closed', { detail: delta })), 1800);
    return () => clearTimeout(t);
  }, [delta]);

  useEffect(() => {
    if (left < 0) return;
    if (left === 0) {
      if (onAdvance) return onAdvance();
      try {
        sessionStorage.setItem(AUTOSTART, lesson.next!.slug);
      } catch {}
      setClosing(false);
      go(`${lesson.basePath}/${lesson.next!.slug}`);
      return;
    }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left, go, lesson, setClosing, onAdvance]);

  const big = !!delta && BIG_DAYS.has(delta.daysPracticed);
  const C = 2 * Math.PI * 24;
  const close = () => setClosing(false);
  return (
    <div className="endscreen" role="dialog" aria-modal="false" aria-labelledby="end-t">
      <Celebration big={big} />
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} style={{ maxWidth: 520 }}>
        {big ? <Lotus tone="primary" size={56} /> : <Icon name="check_circle" fill size={36} className="c-success" />}
        <p className="t-overline c-variant" style={{ marginTop: 8 }}>
          {big ? `¡${delta!.daysPracticed} días de práctica!` : 'Clase completada'}
        </p>
        <h2 id="end-t" className="t-modal" style={{ marginTop: 4 }}>
          Terminaste {lesson.title}
        </h2>
        <p className="t-body-m c-variant" style={{ marginTop: 4 }} aria-live="polite">
          {delta
            ? `${delta.daysPracticed} ${delta.daysPracticed === 1 ? 'día' : 'días'} en tu camino. Quédate un momento en silencio antes de volver a tu día.`
            : 'Quédate un momento en silencio antes de volver a tu día.'}
        </p>

        {lesson.kind === 'practice' ? (
          <>
            <p className="t-body-m" style={{ marginTop: 12 }}>
              Lo que empezaste hoy sigue en vivo: «{EVENT.title}» · martes 1 de diciembre · 7:00 p. m. hora Colombia.
            </p>
            <div className="end-actions">
              <a className={btn('primary', 'lg')} href={regHref} onClick={trackReg}>
                Reservar mi lugar
              </a>
              <button type="button" className={btn('glass', 'lg')} onClick={close}>
                Volver a la práctica
              </button>
            </div>
          </>
        ) : lesson.next ? (
          <>
            {left >= 0 ? (
              <div className="row-c" style={{ justifyContent: 'center', marginTop: 16, gap: 12 }}>
                <div className="ring" aria-label={`La siguiente clase empieza en ${left} segundos`}>
                  <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="var(--sin-surface-container-highest)" strokeWidth="4" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke="var(--sin-primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (left / COUNT)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
                  </svg>
                  <b className="tnum">{left}</b>
                </div>
                <span className="stack" style={{ textAlign: 'left', minWidth: 0 }}>
                  <span className="t-label-s c-variant">Siguiente clase</span>
                  <b className="t-label-l clamp2">{lesson.next.title}</b>
                </span>
              </div>
            ) : (
              <p className="t-body-m" style={{ marginTop: 12 }}>
                Cuando quieras, sigue con «{lesson.next.title}».
              </p>
            )}
            <div className="end-actions">
              {left >= 0 ? (
                <button type="button" className={btn('glass', 'lg')} onClick={() => setLeft(-1)}>
                  Detener
                </button>
              ) : (
                <button type="button" className={btn('glass', 'lg')} onClick={() => (close(), onReplay())}>
                  <Icon name="replay_10" /> Repetir
                </button>
              )}
              <LessonLink href={`${lesson.basePath}/${lesson.next.slug}`} className={btn('primary', 'lg')} onClick={close}>
                Siguiente clase <Icon name="arrow_forward" />
              </LessonLink>
            </div>
          </>
        ) : (
          <div className="end-actions">
            <button type="button" className={btn('glass', 'lg')} onClick={close}>
              Volver a la clase
            </button>
            <a className={btn('primary', 'lg')} href={`/cursos/${lesson.courseSlug}`}>
              Ver el curso
            </a>
          </div>
        )}
      </m.div>
    </div>
  );
}
