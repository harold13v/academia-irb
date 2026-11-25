'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { updatePrefs } from '@/server/actions';
import { Avatar, Empty, Icon, btn } from './sin/ui';
import { useToast } from './ui/toast';

type Today = { id: number; name: string; size: number; practicedToday: string[]; meToday: boolean } | null;

/** Círculos: opt-in, sin ranking. Solo presencia del día ("3 de tu círculo practicaron hoy"). */
export function CirclePanel({ optedIn, today }: { optedIn: boolean; today: Today }) {
  const [on, setOn] = useState(optedIn);
  const toast = useToast();
  const m = useMutation({
    mutationFn: async (v: boolean) => {
      const r = await updatePrefs({ circlesOptIn: v });
      if (!r.ok) throw new Error(r.error);
    },
    onMutate: (v) => setOn(v),
    onError: (e, v) => (setOn(!v), toast(`No se guardó el cambio: ${(e as Error).message}`, true)),
  });
  if (!on)
    return (
      <div className="card pad" style={{ textAlign: 'center' }}>
        <Icon name="groups" size={40} className="c-variant" />
        <h2 className="t-modal" style={{ marginTop: 8 }}>
          Practica acompañada
        </h2>
        <p className="t-body-m c-variant" style={{ maxWidth: 460, margin: '8px auto 16px' }}>
          Un círculo reúne a unas 30 personas durante una semana. Ves quién practicó hoy, sin tablas ni comparaciones. Es opcional y puedes salir cuando quieras.
        </p>
        <button className={btn('primary', 'lg')} type="button" onClick={() => m.mutate(true)}>
          Unirme a un círculo
        </button>
      </div>
    );
  if (!today)
    return (
      <div className="card">
        <Empty icon="groups" title="Ya estás dentro">
          Te asignamos a un círculo con tu próxima práctica.
        </Empty>
      </div>
    );
  const n = today.practicedToday.length;
  return (
    <div className="card pad">
      <p className="t-overline c-variant">{today.name}</p>
      <h2 className="t-page" style={{ marginTop: 4 }}>
        {n === 0 ? 'Hoy aún nadie de tu círculo ha practicado' : `${n} de tu círculo ${n === 1 ? 'practicó' : 'practicaron'} hoy`}
      </h2>
      <p className="t-body-m c-variant" style={{ marginTop: 4 }}>
        {today.meToday ? 'Tú también. Gracias por sostener el círculo.' : 'Tu práctica de hoy también cuenta para el círculo.'} {today.size} personas esta semana.
      </p>
      {n > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {today.practicedToday.map((p, i) => (
            <li key={p + i} className="row-c">
              <Avatar name={p} size={32} />
              <span className="t-label-l">{p}</span>
            </li>
          ))}
        </ul>
      )}
      <button className={btn('plain', 'sm')} type="button" style={{ marginTop: 16 }} onClick={() => m.mutate(false)}>
        Salir de los círculos
      </button>
    </div>
  );
}
