'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { subscribePush } from '@/lib/push';
import { setUiPrefs } from '@/server/social-actions';
import { useToast } from '../ui/toast';
import { Icon, btn } from './ui';

const HOURS = [6, 7, 8, 9, 12, 13, 18, 19, 20, 21, 22, 23];
export const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'a. m.' : 'p. m.'}`;

/** Elegir hora de recordatorio (máx. 1 al día) + permiso push. Se usa en el sheet post-práctica y en Ajustes. */
export function HourPicker({ value, onDone }: { value: number | null; onDone?: (h: number | null) => void }) {
  const [h, setH] = useState<number | null>(value);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async (hour: number | null) => {
    setBusy(true);
    try {
      if (hour !== null) {
        const r = await subscribePush();
        if (r === 'denied') toast('Sin permiso de notificaciones: guardamos la hora y te avisaremos dentro de la academia.');
      }
      const r = await setUiPrefs({ reminderHour: hour });
      if (!r.ok) throw new Error(r.error);
      toast(hour === null ? 'Recordatorio desactivado' : `Te recordaremos a las ${hourLabel(hour)}`);
      onDone?.(hour);
    } catch (e) {
      toast(`No se guardó: ${(e as Error).message}`, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="hours" role="radiogroup" aria-label="Hora del recordatorio">
        {HOURS.map((x) => (
          <button key={x} type="button" role="radio" aria-checked={h === x} className="chip" onClick={() => setH(x)}>
            {hourLabel(x)}
          </button>
        ))}
      </div>
      <div className="row-c" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 8 }}>
        {value !== null && (
          <button type="button" className={btn('plain')} disabled={busy} onClick={() => void save(null)}>
            Desactivar
          </button>
        )}
        <button type="button" className={btn('primary')} disabled={busy || h === null || h === value} onClick={() => void save(h)}>
          <Icon name="notifications" /> Guardar hora
        </button>
      </div>
    </>
  );
}

/** Después de la primera práctica: un sheet amable para elegir la hora. Se pregunta una sola vez. */
export function ReminderSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="sheet glass center" style={{ padding: '0 20px 20px' }}>
          <div className="sheet-grip" />
          <Icon name="schedule" size={32} className="c-primary" style={{ marginTop: 8 }} />
          <Dialog.Title className="t-modal" style={{ marginTop: 8 }}>
            ¿A qué hora te acompañamos?
          </Dialog.Title>
          <Dialog.Description className="t-body-m c-variant" style={{ margin: '4px 0 16px' }}>
            Un solo recordatorio al día, solo si ese día aún no has practicado. Lo cambias cuando quieras en Ajustes.
          </Dialog.Description>
          <HourPicker value={null} onDone={() => onOpenChange(false)} />
          <Dialog.Close className={btn('plain', 'sm')} style={{ alignSelf: 'center', marginTop: 8 }}>
            Ahora no
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
