'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, m } from 'motion/react';
import { useEffect, useState } from 'react';
import { Icon, Lotus } from './sin/ui';

type Item = { kind: 'level'; level: number; name: string; unlock: string | null } | { kind: 'achievement'; title: string };

/** Sheet de cristal que sube desde abajo, se cierra solo a los 5 s y deja el logro en el perfil. */
export function RewardSheet({ item, onDone }: { item: Item; onDone: () => void }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 5000);
    return () => clearTimeout(t);
  }, []);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <AnimatePresence onExitComplete={onDone}>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Content asChild forceMount onOpenAutoFocus={(e) => e.preventDefault()}>
              <m.div
                className="sheet glass center"
                style={{ padding: '8px 24px 24px', textAlign: 'center', alignItems: 'center', bottom: 'calc(88px + env(safe-area-inset-bottom))', left: 12, right: 12, borderRadius: 20 }}
                initial={{ y: 32, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 32, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="sheet-grip" />
                {item.kind === 'level' ? <Lotus tone="secondary" size={56} /> : <Icon name="workspace_premium" fill size={48} className="c-primary" />}
                <p className="t-overline c-variant" style={{ marginTop: 8 }}>
                  {item.kind === 'level' ? 'Nueva etapa del camino' : 'Logro'}
                </p>
                <Dialog.Title className="t-modal" style={{ marginTop: 4 }}>
                  {item.kind === 'level' ? item.name : item.title}
                </Dialog.Title>
                <Dialog.Description className="t-body-m c-variant" style={{ marginTop: 4 }}>
                  {item.kind === 'level'
                    ? item.unlock
                      ? `Se abrió para ti: ${item.unlock}. Lo encuentras en tu perfil.`
                      : 'Tu camino sigue creciendo. Lo verás en tu perfil.'
                    : 'Quedó guardado en tu perfil.'}
                </Dialog.Description>
                <button type="button" className="btn plain sm" onClick={() => setOpen(false)} style={{ marginTop: 12 }}>
                  Cerrar
                </button>
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
