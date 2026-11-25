'use client';

import * as Popover from '@radix-ui/react-popover';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Ticker } from './motion';
import type { WeeklyStreak } from '@/server/social';
import { pauseThisWeek, weeklyStreak } from '@/server/social-actions';
import { useToast } from '../ui/toast';
import { Icon, btn } from './ui';

/** Racha SEMANAL: una práctica en la semana la mantiene. Se refresca con cada delta del worker. */
export function useStreak(initial: WeeklyStreak | null) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['streak'], queryFn: weeklyStreak, initialData: initial, staleTime: 60_000 });
  useEffect(() => {
    const on = () => void qc.invalidateQueries({ queryKey: ['streak'] });
    window.addEventListener('irb:delta', on);
    return () => window.removeEventListener('irb:delta', on);
  }, [qc]);
  return q.data ?? initial;
}

export function WeekRow({ s }: { s: WeeklyStreak }) {
  return (
    <div className="week" role="list" aria-label="Tu semana">
      {s.days.map((d, i) => {
        const cls = d.state === 'done' ? 'done' : s.pausedThisWeek && d.state !== 'future' ? 'paused' : d.state === 'today' ? 'today' : d.state === 'risk' ? 'risk' : '';
        const on = i > 0 && s.days[i - 1]!.state === 'done' && d.state === 'done';
        return (
          <span key={d.day} style={{ display: 'contents' }}>
            {i > 0 && <span className={`week-link${on ? ' on' : ''}`} aria-hidden="true" />}
            <span className="week-day" role="listitem" aria-label={`${d.day}: ${d.state === 'done' ? 'practicaste' : d.state === 'future' ? 'por venir' : 'sin práctica'}`}>
              <span className={`week-dot ${cls}`}>{d.state === 'done' ? <Icon name="check" /> : s.pausedThisWeek && d.state !== 'future' ? <Icon name="pause" /> : null}</span>
              {d.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function StreakCopy({ s }: { s: WeeklyStreak }) {
  const today = s.days.findIndex((d) => d.state === 'today' || d.state === 'risk');
  const left = today >= 0 ? 7 - today : 0;
  const risk = !s.thisWeekDone && !s.pausedThisWeek && today >= 4;
  return (
    <>
      <p className="t-body-m c-variant" style={{ marginTop: 16 }}>
        {s.thisWeekDone
          ? 'Ya practicaste esta semana. Tu racha está a salvo hasta el domingo; cada día extra suma a tu camino.'
          : s.pausedThisWeek
            ? 'Esta semana está en pausa. Tu racha te espera, sin prisa.'
            : 'Una sola práctica esta semana mantiene tu racha. Cinco minutos cuentan.'}
      </p>
      {risk && (
        <div className="risk-note">
          <Icon name="schedule" />
          <span>
            {left === 1 ? 'Hoy es el último día de la semana' : `Quedan ${left} días de esta semana`}. Si hoy no se puede, también puedes pausarla.
          </span>
        </div>
      )}
    </>
  );
}

export function PauseButton({ s }: { s: WeeklyStreak }) {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: async () => {
      const r = await pauseThisWeek();
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => (toast('Semana en pausa. Tu racha te espera.'), qc.invalidateQueries({ queryKey: ['streak'] })),
    onError: (e) => toast((e as Error).message, true),
  });
  if (s.thisWeekDone || s.pausedThisWeek) return null;
  return (
    <button type="button" className={btn('outlined', 'sm')} disabled={s.pausesLeftMonth <= 0 || m.isPending} onClick={() => m.mutate()} title={s.pausesLeftMonth <= 0 ? 'Ya usaste la pausa de este mes' : undefined}>
      <Icon name="pause" /> Pausar mi racha
    </button>
  );
}

/** Ráfaga azafrán (máx. 12 partículas, una vez) al completar el día. */
function Burst() {
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <m.i key={i} initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: Math.cos(a) * 26, y: Math.sin(a) * 26, opacity: 0, scale: 0.4 }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />;
      })}
    </span>
  );
}

export function StreakPill({ streak }: { streak: WeeklyStreak }) {
  const s = useStreak(streak)!;
  const todayDone = !s.days.some((d) => d.state === 'today' || d.state === 'risk');
  const prev = useRef(todayDone);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ gained: number }>).detail;
      if (d.gained > 0 && !prev.current) {
        prev.current = true;
        setBurst(true);
      }
    };
    window.addEventListener('irb:delta', on);
    return () => window.removeEventListener('irb:delta', on);
  }, []);
  const risk = !s.thisWeekDone && !s.pausedThisWeek;
  return (
    <Popover.Root>
      <Popover.Trigger className="streak-pill" data-risk={risk} aria-label={s.hidden ? 'Tu racha' : `Racha de ${s.weeks} ${s.weeks === 1 ? 'semana' : 'semanas'}`}>
        <Icon name="local_fire_department" fill={s.thisWeekDone} />
        {burst && <Burst />}
        {!s.hidden && <Ticker value={s.weeks} />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover" align="end" sideOffset={8} collisionPadding={16}>
          <div className="row-c" style={{ gap: 12 }}>
            <Icon name="local_fire_department" fill size={32} className={risk ? '' : 'c-primary'} style={risk ? { color: 'var(--sin-warning)' } : undefined} />
            <div>
              {s.hidden ? (
                <b className="t-modal">Tu semana</b>
              ) : (
                <b className="t-modal tnum">
                  {s.weeks} {s.weeks === 1 ? 'semana' : 'semanas'} seguidas
                </b>
              )}
              <p className="t-label-m c-variant">{s.totalDays} {s.totalDays === 1 ? 'día' : 'días'} de práctica en total</p>
            </div>
          </div>
          <WeekRow s={s} />
          <StreakCopy s={s} />
          <div className="row-c" style={{ marginTop: 16, justifyContent: 'space-between' }}>
            <PauseButton s={s} />
            <Popover.Close asChild>
              <Link className={btn('plain', 'sm')} href="/perfil#progreso" style={{ marginLeft: 'auto' }}>
                Ver mi progreso <Icon name="chevron_right" />
              </Link>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
