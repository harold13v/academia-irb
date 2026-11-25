'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { CommentRow } from '@/server/social';
import { listComments, postComment, toggleCommentFav, toggleCommentLike } from '@/server/social-actions';
import { useToast } from '../ui/toast';
import { Avatar, Empty, Icon, Skeleton, Tag, btn } from '../sin/ui';

const FILTERS = [
  { key: 'todo', label: 'Todo' },
  { key: 'aportes', label: 'Aportes' },
  { key: 'preguntas', label: 'Preguntas' },
  { key: 'sin-responder', label: 'Sin responder' },
  { key: 'favoritos', label: 'Favoritos' },
];
const ago = (d: Date | string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 3600) return `hace ${Math.max(1, Math.floor(s / 60))} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 2592000) return `hace ${Math.floor(s / 86400)} d`;
  return new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

function Badge({ b }: { b: string | null }) {
  if (!b) return null;
  return <Tag tone={b === 'Ximena' ? 'primary' : 'secondary'} icon="verified">{b}</Tag>;
}

function Composer({ lessonId, parentId, me, onDone, autoOpen }: { lessonId: number; parentId: number | null; me: string | null; onDone?: () => void; autoOpen?: boolean }) {
  const [open, setOpen] = useState(!!autoOpen);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'aporte' | 'pregunta'>('aporte');
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: async () => {
      const r = await postComment({ lessonId, body: text, kind, parentId });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setText('');
      setOpen(false);
      onDone?.();
      toast(parentId ? 'Respuesta publicada' : 'Gracias por compartir');
      void qc.invalidateQueries({ queryKey: ['comments', lessonId] });
    },
    onError: (e) => toast((e as Error).message, true),
  });
  if (!me)
    return (
      <a className="composer" href={`/entrar?next=${encodeURIComponent(location.pathname)}`}>
        <Icon name="chat_bubble" /> Entra para comentar
      </a>
    );
  if (!open)
    return (
      <button type="button" className="composer" onClick={() => setOpen(true)}>
        <Avatar name={me} size={24} />
        {parentId ? 'Escribe tu respuesta…' : 'Comparte un aporte o haz una pregunta…'}
      </button>
    );
  return (
    <div className="composer-open">
      {!parentId && (
        <div className="chips" role="radiogroup" aria-label="Tipo de comentario" style={{ marginBottom: 8 }}>
          <button type="button" role="radio" aria-checked={kind === 'aporte'} className="chip sm" onClick={() => setKind('aporte')}>
            Aporte
          </button>
          <button type="button" role="radio" aria-checked={kind === 'pregunta'} className="chip sm" onClick={() => setKind('pregunta')}>
            Pregunta
          </button>
        </div>
      )}
      <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} aria-label="Tu comentario" placeholder={kind === 'pregunta' ? '¿Qué te gustaría preguntar?' : 'Lo que sentiste, lo que descubriste…'} />
      <div className="row-c" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className={btn('plain', 'sm')} onClick={() => (setOpen(false), onDone?.())}>
          Cancelar
        </button>
        <button type="button" className={btn('primary', 'sm')} disabled={text.trim().length < 2 || m.isPending} onClick={() => m.mutate()}>
          Publicar
        </button>
      </div>
    </div>
  );
}

function Comment({ c, replies, lessonId, me }: { c: CommentRow; replies: CommentRow[]; lessonId: number; me: string | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [replying, setReplying] = useState(false);
  const [liked, setLiked] = useState(c.liked);
  const [likes, setLikes] = useState(c.likes);
  const [fav, setFav] = useState(c.fav);
  const like = async () => {
    if (!me) return toast('Entra a tu cuenta para dar Me gusta.');
    setLiked(!liked);
    setLikes((n) => n + (liked ? -1 : 1));
    const r = await toggleCommentLike(c.id);
    if (!r.ok) (setLiked(liked), setLikes(c.likes), toast(r.error, true));
  };
  const favorite = async () => {
    if (!me) return toast('Entra a tu cuenta.');
    setFav(!fav);
    const r = await toggleCommentFav(c.id);
    if (!r.ok) (setFav(fav), toast(r.error, true));
    else void qc.invalidateQueries({ queryKey: ['comments', lessonId, 'favoritos'] });
  };
  return (
    <article className={`cmt${c.parentId ? ' reply' : ''}`}>
      <Avatar name={c.author} size={c.parentId ? 24 : 32} />
      <div style={{ minWidth: 0 }}>
        <div className="row-c" style={{ flexWrap: 'wrap', gap: 6 }}>
          <b className="t-label-l">{c.author}</b>
          <Badge b={c.badge} />
          <span className="t-label-s c-variant">
            {c.stage} · {ago(c.createdAt)}
          </span>
        </div>
        {c.kind === 'pregunta' && !c.parentId && (
          <div style={{ marginTop: 4 }}>
            <Tag tone="info" icon="help">
              Pregunta
            </Tag>
          </div>
        )}
        <p className="cmt-body">{c.body}</p>
        <div className="cmt-actions">
          <button type="button" className={btn('plain', 'sm')} aria-pressed={liked} onClick={() => void like()} style={liked ? { color: 'var(--sin-primary)' } : undefined}>
            <Icon name="thumb_up" fill={liked} /> <span className="tnum">{likes || ''}</span>
            <span className="sr-only">Me gusta</span>
          </button>
          {!c.parentId && (
            <button type="button" className={btn('plain', 'sm')} onClick={() => setReplying((r) => !r)}>
              <Icon name="chat_bubble" /> Responder{c.replies ? ` · ${c.replies}` : ''}
            </button>
          )}
          {!c.parentId && (
            <button type="button" className={btn('plain', 'sm', 'icon')} aria-pressed={fav} aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'} onClick={() => void favorite()}>
              <Icon name="bookmark" fill={fav} />
            </button>
          )}
        </div>
        {replies.map((r) => (
          <Comment key={r.id} c={r} replies={[]} lessonId={lessonId} me={me} />
        ))}
        {replying && (
          <div style={{ marginTop: 8 }}>
            <Composer lessonId={lessonId} parentId={c.id} me={me} autoOpen onDone={() => setReplying(false)} />
          </div>
        )}
      </div>
    </article>
  );
}

/** Comentarios: cabecera sticky con filtros y orden; composer colapsado a 54px; insignias "Ximena" / "Equipo IRB". */
export function Comments({ lessonId, me, locked }: { lessonId: number; me: string | null; locked: boolean }) {
  const [filter, setFilter] = useState('todo');
  const [sort, setSort] = useState<'votos' | 'nuevos'>('votos');
  const { data, isLoading } = useQuery({ queryKey: ['comments', lessonId, filter, sort], queryFn: () => listComments(lessonId, filter, sort), enabled: !locked });
  if (locked)
    return (
      <Empty icon="lock" title="Comentarios del curso">
        Se abren cuando el curso está en tu cuenta.
      </Empty>
    );
  const top = data?.rows.filter((r) => !r.parentId) ?? [];
  const replies = (id: number) => (data?.rows.filter((r) => r.parentId === id) ?? []).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  return (
    <>
      <div className="cmt-head">
        <div className="row-c" style={{ justifyContent: 'space-between' }}>
          <b className="t-label-l tnum">{data ? `${data.total} ${data.total === 1 ? 'comentario' : 'comentarios'}` : 'Comentarios'}</b>
          <Menu.Root>
            <Menu.Trigger className={btn('plain', 'sm')}>
              {sort === 'votos' ? 'Más votados' : 'Nuevos'} <Icon name="expand_more" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className="menu" align="end" sideOffset={4}>
                <Menu.RadioGroup value={sort} onValueChange={(v) => setSort(v as 'votos' | 'nuevos')}>
                  <Menu.RadioItem value="votos" className="menu-item">
                    Más votados
                  </Menu.RadioItem>
                  <Menu.RadioItem value="nuevos" className="menu-item">
                    Nuevos
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
        <div className="chips" role="group" aria-label="Filtrar comentarios">
          {FILTERS.filter((f) => me || f.key !== 'favoritos').map((f) => (
            <button key={f.key} type="button" className="chip sm" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <Composer lessonId={lessonId} parentId={null} me={me} />
      </div>
      {isLoading ? (
        Array.from({ length: 3 }, (_, i) => <Skeleton key={i} h={88} style={{ marginTop: 12 }} />)
      ) : !top.length ? (
        <Empty icon="chat_bubble" title={filter === 'todo' ? 'Sé la primera voz' : 'Nada por aquí'}>
          {filter === 'todo' ? 'Comparte lo que sentiste en esta práctica o deja una pregunta para el Equipo IRB.' : 'Prueba con otro filtro.'}
        </Empty>
      ) : (
        top.map((c) => <Comment key={c.id} c={c} replies={replies(c.id)} lessonId={lessonId} me={me} />)
      )}
    </>
  );
}
