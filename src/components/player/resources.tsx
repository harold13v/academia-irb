'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { fmt } from '@/lib/fmt';
import { addNote, deleteNote } from '@/server/actions';
import { useToast } from '../ui/toast';
import { Empty, Icon, btn } from '../sin/ui';
import { lsGet, lsPut, useLessonCtx, type LessonData, type Note } from '../lesson/context';
import { LessonLink } from './nav';
import type { OutlineView } from './types';

const FILE = /\.(pdf|docx?|xlsx?|pptx?|mp3|m4a|zip|epub)(\?|$)/i;

/** Enlaces del cuerpo de la clase, separados en archivos y enlaces. */
function useLinks(html: string) {
  return useMemo(() => {
    const out: { href: string; label: string; file: boolean }[] = [];
    if (!html) return out;
    const re = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(re)) {
      const href = m[1]!;
      if (!/^https?:/.test(href) || out.some((o) => o.href === href)) continue;
      const label = m[2]!.replace(/<[^>]+>/g, '').trim() || href.replace(/^https?:\/\//, '').slice(0, 60);
      out.push({ href, label, file: FILE.test(href) });
    }
    return out;
  }, [html]);
}

function Prep({ lesson }: { lesson: LessonData }) {
  const { player } = useLessonCtx();
  const [checks, setChecks] = useState<boolean[]>([]);
  useEffect(() => setChecks(lesson.prep.map((_, i) => !!lsGet<boolean>(lesson, `c${i + 1}`))), [lesson]);
  return (
    <section className="res-section">
      <p className="t-overline c-variant">Antes de empezar</p>
      <p className="t-body-m" style={{ marginTop: 8 }}>
        La práctica dura {Math.round(lesson.durationS / 60)} minutos. Prepárate antes de darle play.
      </p>
      <ul className="checklist">
        {lesson.prep.map((t, i) => (
          <li key={t}>
            <label>
              <input
                type="checkbox"
                checked={!!checks[i]}
                onChange={(e) => {
                  const v = e.target.checked;
                  setChecks((c) => c.map((x, j) => (j === i ? v : x)));
                  lsPut(lesson, `c${i + 1}`, v);
                }}
              />
              <span>{t}</span>
            </label>
          </li>
        ))}
      </ul>
      {lesson.playable && (
        <button
          className={btn('primary', 'md', 'wide')}
          type="button"
          style={{ marginTop: 8 }}
          onClick={() => {
            document.getElementById('video')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            player.current?.play();
          }}
        >
          <Icon name="play_arrow" fill /> Estoy lista, estoy listo: empezar
        </button>
      )}
    </section>
  );
}

function Notes({ lesson }: { lesson: LessonData }) {
  const { time, player, notes, setNotes } = useLessonCtx();
  const toast = useToast();
  const [text, setText] = useState('');
  // sin cuenta, las notas viven en este dispositivo (mismas claves que la Fase 1)
  useEffect(() => {
    if (!lesson.signedIn) setNotes((lsGet<{ t: number; text: string }[]>(lesson, 'notes') ?? []).map((n, i) => ({ id: -1 - i, positionS: n.t, text: n.text })));
  }, [lesson, setNotes]);
  const saveLocal = (list: Note[]) => lsPut(lesson, 'notes', list.map((n) => ({ t: n.positionS, text: n.text })));
  const add = useMutation({
    mutationFn: async (n: Note) => {
      if (!lesson.signedIn) return n;
      const r = await addNote({ lessonId: lesson.id, positionS: Math.round(n.positionS), text: n.text });
      if (!r.ok) throw new Error(r.error);
      return { ...n, id: r.data!.id, pending: false };
    },
    onMutate: (n) => {
      const prev = notes;
      const next = [{ ...n, pending: lesson.signedIn }, ...prev];
      setNotes(next);
      if (!lesson.signedIn) saveLocal(next);
      return { prev };
    },
    onSuccess: (saved, n) => (setNotes([saved, ...notes.filter((x) => x.id !== n.id)]), toast(`Nota en ${fmt(n.positionS)} guardada`)),
    onError: (e, _n, ctx) => (setNotes(ctx?.prev ?? []), toast(`La nota no se guardó: ${(e as Error).message}`, true)),
  });
  const del = async (n: Note) => {
    const prev = notes;
    const next = notes.filter((x) => x.id !== n.id);
    setNotes(next);
    if (!lesson.signedIn) return saveLocal(next);
    const r = await deleteNote(n.id);
    if (!r.ok) (setNotes(prev), toast(`No se pudo borrar: ${r.error}`, true));
  };
  return (
    <section className="res-section">
      <p className="t-overline c-variant">Tus notas</p>
      <div className="composer-open" style={{ marginTop: 8 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} placeholder="Lo que quiero soltar…" aria-label={`Nota en el minuto ${fmt(time)}`} style={{ minHeight: 64 }} />
        <div className="row-c" style={{ justifyContent: 'space-between' }}>
          <span className="t-label-s c-variant">{lesson.signedIn ? `Se guarda en ${fmt(time)}` : 'Solo en este dispositivo'}</span>
          <button
            type="button"
            className={btn('primary', 'sm')}
            disabled={!text.trim()}
            onClick={() => {
              const v = text.trim();
              setText('');
              add.mutate({ id: -Date.now(), positionS: Math.round(time), text: v });
            }}
          >
            Guardar nota
          </button>
        </div>
      </div>
      {notes.map((n) => (
        <div key={n.id} className="row-c" style={{ alignItems: 'flex-start', padding: '10px 0', opacity: n.pending ? 0.6 : 1 }}>
          <button type="button" className="tag md tnum" onClick={() => player.current?.seek(n.positionS)} aria-label={`Ir al minuto ${fmt(n.positionS)}`} style={{ border: 0, cursor: 'pointer' }}>
            {fmt(n.positionS)}
          </button>
          <span className="t-body-m" style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
            {n.text}
          </span>
          <button type="button" className={btn('plain', 'sm', 'icon')} aria-label="Borrar nota" onClick={() => void del(n)}>
            <Icon name="close" />
          </button>
        </div>
      ))}
    </section>
  );
}

/** Recursos: Resumen (con Copiar), Archivos, Enlaces, Lecturas y notas con minuto. */
export function Resources({ outline }: { outline: OutlineView }) {
  const { lesson } = useLessonCtx();
  const toast = useToast();
  const links = useLinks(lesson.bodyHtml);
  const files = links.filter((l) => l.file);
  const web = links.filter((l) => !l.file);
  const readings = outline.modules.flatMap((m) => m.lessons).filter((l) => (l.mediaType === 'texto' || l.mediaType === 'gdoc') && l.id !== lesson.id);
  if (lesson.locked)
    return (
      <Empty icon="lock" title="Recursos de la clase">
        Se abren cuando el curso está en tu cuenta.
      </Empty>
    );
  const copy = async () => {
    const tmp = document.createElement('div');
    tmp.innerHTML = lesson.bodyHtml;
    await navigator.clipboard.writeText(tmp.innerText.trim()).then(() => toast('Resumen copiado'), () => toast('No se pudo copiar', true));
  };
  return (
    <>
      {lesson.prep.length > 0 && <Prep lesson={lesson} />}
      <section className="res-section">
        <div className="row-c" style={{ justifyContent: 'space-between' }}>
          <p className="t-overline c-variant">Resumen</p>
          {lesson.bodyHtml && lesson.mediaType !== 'texto' && (
            <button type="button" className={btn('plain', 'sm')} onClick={() => void copy()}>
              <Icon name="content_copy" /> Copiar
            </button>
          )}
        </div>
        {lesson.mediaType === 'texto' ? (
          <p className="t-body-m c-variant" style={{ marginTop: 8 }}>
            La lectura completa está en el panel principal.
          </p>
        ) : lesson.bodyHtml ? (
          <div className="prose-irb" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: lesson.bodyHtml }} />
        ) : (
          <p className="t-body-m c-variant" style={{ marginTop: 8 }}>
            Esta clase no tiene texto de apoyo.
          </p>
        )}
      </section>
      {(files.length > 0 || (lesson.mediaType === 'gdoc' && lesson.mediaUrl)) && (
        <section className="res-section">
          <p className="t-overline c-variant">Archivos</p>
          {lesson.mediaType === 'gdoc' && lesson.mediaUrl && (
            <a className="res-link" href={lesson.mediaUrl} target="_blank" rel="noopener noreferrer">
              <span className="ico">
                <Icon name="description" />
              </span>
              Documento de la clase
            </a>
          )}
          {files.map((f) => (
            <a key={f.href} className="res-link" href={f.href} target="_blank" rel="noopener noreferrer">
              <span className="ico">
                <Icon name="download" />
              </span>
              <span className="clamp2">{f.label}</span>
            </a>
          ))}
        </section>
      )}
      {web.length > 0 && (
        <section className="res-section">
          <p className="t-overline c-variant">Enlaces</p>
          {web.map((f) => (
            <a key={f.href} className="res-link" href={f.href} target="_blank" rel="noopener noreferrer">
              <span className="ico">
                <Icon name="link" />
              </span>
              <span className="clamp2">{f.label}</span>
            </a>
          ))}
        </section>
      )}
      {readings.length > 0 && (
        <section className="res-section">
          <p className="t-overline c-variant">Lecturas</p>
          {readings.slice(0, 8).map((r) => (
            <LessonLink key={r.id} className="res-link" href={`${lesson.basePath}/${r.slug}`}>
              <span className="ico">
                <Icon name="article" />
              </span>
              <span className="clamp2">{r.title}</span>
            </LessonLink>
          ))}
        </section>
      )}
      <Notes lesson={lesson} />
    </>
  );
}
