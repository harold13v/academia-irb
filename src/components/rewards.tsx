'use client';

import { useEffect, useState } from 'react';
import type { Delta } from './live';
import { useToast } from './ui/toast';
import { haptic } from '@/lib/feedback';

type Item = { kind: 'level'; level: number; name: string; unlock: string | null } | { kind: 'achievement'; title: string };

/** Escucha los deltas del worker. XP → toast discreto. Nivel o logro → sheet (Motion se carga al abrir el primero). */
export function Rewards({ first }: { first?: Delta }) {
  const toast = useToast();
  const [queue, setQueue] = useState<Item[]>([]);
  const [Sheet, setSheet] = useState<null | typeof import('./reward-sheet').RewardSheet>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Delta>).detail;
      if (d.gained > 0 && !document.querySelector('.endscreen')) toast(`+${d.gained} XP · ${d.reason ?? 'Práctica'}`);
      const items: Item[] = [];
      if (d.levelUp) items.push({ kind: 'level', level: d.level, name: d.levelName, unlock: d.unlock });
      for (const a of d.achievements) items.push({ kind: 'achievement', title: a.title });
      if (items.length) {
        haptic();
        setQueue((q) => [...q, ...items]);
        void import('./reward-sheet').then((m) => setSheet(() => m.RewardSheet));
      }
    };
    window.addEventListener('irb:delta', on);
    if (first) on(new CustomEvent('irb:delta', { detail: first }));
    return () => window.removeEventListener('irb:delta', on);
  }, [toast, first]);

  if (!Sheet || !queue[0]) return null;
  return <Sheet key={JSON.stringify(queue[0])} item={queue[0]} onDone={() => setQueue((q) => q.slice(1))} />;
}
