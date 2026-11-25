'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listNotifications, markNotificationsRead } from '@/server/social-actions';
import { Empty, Icon, Skeleton } from './ui';

const FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'sin-leer', label: 'Sin leer' },
  { key: 'comment', label: 'Comentarios' },
  { key: 'practice', label: 'Nuevas prácticas' },
  { key: 'circle', label: 'Círculos' },
];
const ICON: Record<string, string> = { comment: 'chat_bubble', practice: 'self_improvement', circle: 'groups', reminder: 'schedule' };

/** Conteo de no leídas: arranca con el dato del servidor y se refresca con el evento SSE "notification". */
export function useUnread(initial: number) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notif-unread'], queryFn: async () => (await listNotifications('sin-leer')).unread, initialData: initial, staleTime: 60_000 });
  useEffect(() => {
    const on = () => void qc.invalidateQueries({ queryKey: ['notif-unread'] }).then(() => qc.invalidateQueries({ queryKey: ['notif'] }));
    window.addEventListener('irb:notification', on);
    return () => window.removeEventListener('irb:notification', on);
  }, [qc]);
  return data ?? 0;
}

const ago = (d: Date | string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

/** SidePanel de notificaciones: máx. 420px, chips de filtro, datos en vivo por SSE. */
export function NotificationsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [filter, setFilter] = useState('todas');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['notif', filter], queryFn: () => listNotifications(filter), enabled: open });
  const readAll = async () => {
    await markNotificationsRead();
    qc.setQueryData(['notif-unread'], 0);
    void qc.invalidateQueries({ queryKey: ['notif'] });
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="side-panel" aria-describedby={undefined}>
          <div className="panel-head">
            <Dialog.Title className="t-modal" style={{ flex: 1 }}>
              Notificaciones
            </Dialog.Title>
            <button type="button" className="btn plain sm" onClick={() => void readAll()} disabled={!data?.unread}>
              <Icon name="done_all" /> Marcar leídas
            </button>
            <Dialog.Close className="icon-btn" aria-label="Cerrar">
              <Icon name="close" />
            </Dialog.Close>
          </div>
          <div className="chips" role="group" aria-label="Filtrar notificaciones" style={{ padding: '0 16px 12px' }}>
            {FILTERS.map((f) => (
              <button key={f.key} type="button" className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="panel-body" style={{ padding: '0 8px 24px' }}>
            {isLoading ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={64} style={{ margin: '8px' }} />)
            ) : !data?.rows.length ? (
              <Empty icon="notifications" title="Todo en calma">
                Aquí verás respuestas a tus comentarios, prácticas nuevas y noticias de tu círculo.
              </Empty>
            ) : (
              data.rows.map((n) => {
                const inner = (
                  <>
                    <span className="ico">
                      <Icon name={ICON[n.kind] ?? 'notifications'} />
                    </span>
                    <span className="stack" style={{ minWidth: 0 }}>
                      <b className="t-label-l">{n.title}</b>
                      <span className="t-body-m c-variant clamp2">{n.body}</span>
                      <span className="t-label-s c-variant">{ago(n.createdAt)}</span>
                    </span>
                    {!n.readAt ? <span className="unread" aria-label="Sin leer" /> : <span />}
                  </>
                );
                const mark = () => !n.readAt && void markNotificationsRead(n.id).then(() => qc.invalidateQueries({ queryKey: ['notif-unread'] }));
                return n.href ? (
                  <Link key={n.id} href={n.href} className="notif" onClick={() => (mark(), onOpenChange(false))}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id} className="notif" onClick={mark}>
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
