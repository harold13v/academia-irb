'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type Delta = {
  gained: number; xp: number; level: number; levelName: string; levelUp: boolean; unlock: string | null;
  achievements: { key: string; title: string }[]; daysPracticed: number; currentRun: number; todaySeconds: number; goalSeconds: number;
  goalMetNow: boolean; reason: string | null;
};
export type CircleRow = { me: boolean; name: string; minutes: number };

/* store mínimo sin dependencias: último delta, presencia y círculo */
type State = { last: Delta | null; presence: number | null; circle: { name: string; rows: CircleRow[] } | null };
let state: State = { last: null, presence: null, circle: null };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};
export const useLive = <T,>(sel: (s: State) => T) => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => sel(state), () => sel(state));

const Ctx = createContext<(ch: { practice?: number; circle?: boolean }) => void>(() => {});
/** Una página declara qué canales quiere (presencia de una práctica, círculo). */
export function useLiveChannels(ch: { practice?: number; circle?: boolean }) {
  const reg = useContext(Ctx);
  useEffect(() => reg(ch), [reg, ch.practice, ch.circle]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Un único EventSource por pestaña. Reconecta solo (EventSource) y vuelca cada delta en la caché de TanStack Query. */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [ch, setCh] = useState<{ practice?: number; circle?: boolean }>({});
  const es = useRef<EventSource | null>(null);

  useEffect(() => {
    const q = new URLSearchParams();
    if (ch.practice) q.set('practice', String(ch.practice));
    if (ch.circle) q.set('circle', '1');
    const src = new EventSource(`/api/stream?${q}`);
    es.current = src;
    src.addEventListener('stats', (e) => {
      const d = JSON.parse((e as MessageEvent).data) as Delta;
      set({ last: d });
      qc.setQueryData(['stats'], (old: Record<string, unknown> | undefined) => ({ ...(old ?? {}), xp: d.xp, level: d.level, levelName: d.levelName, daysPracticed: d.daysPracticed, currentRun: d.currentRun, todaySeconds: d.todaySeconds, goalSeconds: d.goalSeconds }));
      window.dispatchEvent(new CustomEvent('irb:delta', { detail: d }));
    });
    src.addEventListener('presence', (e) => set({ presence: (JSON.parse((e as MessageEvent).data) as { n: number }).n }));
    src.addEventListener('notification', () => window.dispatchEvent(new CustomEvent('irb:notification')));
    src.addEventListener('circle', (e) => set({ circle: JSON.parse((e as MessageEvent).data) }));
    return () => src.close();
  }, [ch.practice, ch.circle, qc]);

  return <Ctx.Provider value={setCh}>{children}</Ctx.Provider>;
}
