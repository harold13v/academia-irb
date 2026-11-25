'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { updatePrefs } from '@/server/actions';
import { setUiPrefs } from '@/server/social-actions';
import { useToast } from '../ui/toast';
import { HourPicker, hourLabel } from './reminder';
import { Icon, btn } from './ui';

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

/** Ocultar racha: la racha sigue contando, solo deja de mostrarse el número. */
export function HideStreakRow({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: async (v: boolean) => {
      const r = await setUiPrefs({ hideStreak: v });
      if (!r.ok) throw new Error(r.error);
    },
    onMutate: (v) => setOn(v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['streak'] }),
    onError: (e, v) => (setOn(!v), toast(`No se guardó: ${(e as Error).message}`, true)),
  });
  return (
    <div className="pref-row">
      <span className="stack">
        <b className="t-label-l">Ocultar mi racha</b>
        <span className="t-body-m c-variant">Sigue contando, pero no verás el número en la barra superior.</span>
      </span>
      <Switch checked={on} onChange={(v) => m.mutate(v)} label="Ocultar mi racha" />
    </div>
  );
}

export function Settings({ reminderHour, sound, goal, circles }: { reminderHour: number | null; sound: boolean; goal: number; circles: boolean }) {
  const toast = useToast();
  const [hour, setHour] = useState(reminderHour);
  const [editing, setEditing] = useState(false);
  const [snd, setSnd] = useState(sound);
  const [g, setG] = useState(goal);
  const [c, setC] = useState(circles);
  const save = async (p: Parameters<typeof updatePrefs>[0], undo: () => void) => {
    const r = await updatePrefs(p);
    if (!r.ok) (undo(), toast(`No se guardó: ${r.error}`, true));
  };
  return (
    <div className="card pad">
      <div className="pref-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
        <div className="row-c" style={{ width: '100%', justifyContent: 'space-between' }}>
          <span className="stack">
            <b className="t-label-l">Recordatorio diario</b>
            <span className="t-body-m c-variant">{hour === null ? 'Desactivado' : `A las ${hourLabel(hour)}, solo si ese día no has practicado.`}</span>
          </span>
          <button type="button" className={btn('outlined', 'sm')} onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
            {editing ? 'Cerrar' : hour === null ? 'Activar' : 'Cambiar'}
          </button>
        </div>
        {editing && (
          <div style={{ width: '100%', marginTop: 12 }}>
            <HourPicker value={hour} onDone={(h) => (setHour(h), setEditing(false))} />
          </div>
        )}
      </div>
      <div className="pref-row">
        <span className="stack">
          <b className="t-label-l">Meta diaria</b>
          <span className="t-body-m c-variant">Minutos que te propones practicar cada día.</span>
        </span>
        <span className="chips" role="radiogroup" aria-label="Meta diaria">
          {([5, 10, 20] as const).map((m) => (
            <button key={m} type="button" role="radio" className="chip" aria-checked={g === m} onClick={() => (setG(m), void save({ dailyGoalMin: m }, () => setG(g)))}>
              {m} min
            </button>
          ))}
        </span>
      </div>
      <div className="pref-row">
        <span className="stack">
          <b className="t-label-l">Sonido de cuenco al terminar</b>
          <span className="t-body-m c-variant">Un cierre suave al completar una práctica.</span>
        </span>
        <Switch checked={snd} onChange={(v) => (setSnd(v), void save({ soundOn: v }, () => setSnd(!v)))} label="Sonido de cuenco" />
      </div>
      <div className="pref-row">
        <span className="stack">
          <b className="t-label-l">Círculos de práctica</b>
          <span className="t-body-m c-variant">Practica acompañada: ves quién de tu círculo practicó hoy. Sin rankings.</span>
        </span>
        <Switch checked={c} onChange={(v) => (setC(v), void save({ circlesOptIn: v }, () => setC(!v)))} label="Círculos de práctica" />
      </div>
    </div>
  );
}

/** Certificado compartible (Web Share; si no hay, copia el enlace). */
export function ShareButton({ title, url }: { title: string; url: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className={btn('tonal', 'sm')}
      onClick={async () => {
        const full = new URL(url, location.origin).toString();
        if (navigator.share) await navigator.share({ title, text: `Completé «${title}» en la Academia IRB®`, url: full }).catch(() => {});
        else (await navigator.clipboard.writeText(full).catch(() => {}), toast('Enlace copiado'));
      }}
    >
      <Icon name="share" /> Compartir
    </button>
  );
}
