'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SearchItem } from '@/server/shell';
import { Icon } from './ui';

const GROUPS: { key: SearchItem['group']; icon: string }[] = [
  { key: 'Curso', icon: 'school' },
  { key: 'Clase', icon: 'smart_display' },
  { key: 'Práctica', icon: 'self_improvement' },
  { key: 'Círculo', icon: 'groups' },
];

/** ⌘K: cmdk sobre Radix Dialog, 640px, campo de cristal de 52px. "?" abre los atajos. */
export function CommandMenu({ open, onOpenChange, index, onShortcuts }: { open: boolean; onOpenChange: (v: boolean) => void; index: SearchItem[]; onShortcuts: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const go = (href: string) => {
    onOpenChange(false);
    setQ('');
    router.push(href);
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="dialog" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Buscar en la academia</Dialog.Title>
          <Command label="Buscar" loop>
            <div className="glass-input">
              <Icon name="search" />
              <Command.Input
                value={q}
                onValueChange={(v) => (v === '?' ? (setQ(''), onShortcuts()) : setQ(v))}
                placeholder="Busca cursos, clases, prácticas y círculos"
                autoFocus
              />
              <Dialog.Close className="icon-btn" aria-label="Cerrar">
                <Icon name="close" />
              </Dialog.Close>
            </div>
            <Command.List className="cmd-list" style={{ maxHeight: 'calc(76dvh - 120px)' }}>
              <Command.Empty>No encontramos nada con «{q}». Prueba con otra palabra.</Command.Empty>
              {GROUPS.map((g) => {
                const items = index.filter((i) => i.group === g.key);
                if (!items.length) return null;
                return (
                  <Command.Group key={g.key} heading={g.key === 'Curso' ? 'Cursos' : g.key === 'Clase' ? 'Clases' : g.key === 'Práctica' ? 'Prácticas' : 'Círculos'}>
                    {(q ? items : items.slice(0, g.key === 'Clase' ? 5 : 8)).map((i) => (
                      <Command.Item key={i.href} value={`${i.title} ${i.sub} ${i.href}`} onSelect={() => go(i.href)} className="cmd-item">
                        <span className="ico">{i.cover ? <Image src={i.cover} alt="" fill sizes="40px" /> : <Icon name={g.icon} size={16} />}</span>
                        <span className="stack" style={{ minWidth: 0 }}>
                          <span className="clamp1">{i.title}</span>
                          <span className="t-label-s c-variant clamp1">{i.sub}</span>
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
          <div className="cmd-foot">
            <span className="row-c">
              <span className="keycap">↑</span>
              <span className="keycap">↓</span> navegar
            </span>
            <span className="row-c">
              <span className="keycap">↵</span> abrir
            </span>
            <span className="row-c">
              <span className="keycap">esc</span> cerrar
            </span>
            <button type="button" className="row-c" onClick={onShortcuts} style={{ marginLeft: 'auto', background: 'none', border: 0, color: 'inherit', font: 'inherit' }}>
              <span className="keycap">?</span> atajos
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const SHORTCUTS: [string, [string, string][]][] = [
  ['General', [['⌘ K', 'Buscar'], ['/', 'Buscar'], ['?', 'Ver atajos'], ['⌘ \\', 'Contraer el menú lateral']]],
  [
    'Reproductor',
    [['Espacio · K', 'Reproducir o pausar'], ['← · →', 'Retroceder o avanzar 5 s'], ['J · L', 'Retroceder o avanzar 10 s'], ['↑ · ↓', 'Volumen'], ['M', 'Silenciar'], ['F', 'Pantalla completa'], ['C', 'Subtítulos'], ['< · >', 'Velocidad'], ['N', 'Siguiente clase'], ['0–9', 'Ir a ese porcentaje']],
  ],
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="dialog sm" aria-describedby={undefined}>
          <div className="panel-head">
            <Icon name="keyboard" />
            <Dialog.Title className="t-modal" style={{ flex: 1 }}>
              Atajos de teclado
            </Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="Cerrar">
              <Icon name="close" />
            </Dialog.Close>
          </div>
          <div className="panel-body">
            {SHORTCUTS.map(([g, rows]) => (
              <section key={g} style={{ marginTop: 8 }}>
                <p className="t-overline c-variant" style={{ margin: '12px 0 4px' }}>
                  {g}
                </p>
                {rows.map(([k, d]) => (
                  <div key={k + d} className="pref-row" style={{ padding: '8px 0' }}>
                    <span className="t-body-m">{d}</span>
                    <span className="row-c" style={{ gap: 4 }}>
                      {k.split(' ').map((x, i) => (x === '·' ? <span key={i} className="c-variant">o</span> : <span key={i} className="keycap">{x}</span>))}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
