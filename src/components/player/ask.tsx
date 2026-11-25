'use client';

import { m } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Icon, btn } from '../sin/ui';
import { useLessonCtx } from '../lesson/context';

type Msg = { me: boolean; text: string };
const SUGGEST = ['¿De qué trata esta práctica?', '¿Cómo me preparo?', 'Ejercicio de reflexión: ¿qué quiero soltar hoy?'];

/** Dock de 64px con borde degradado al pasar el cursor. */
export function AskDock({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="ai-dock" onClick={onOpen} aria-label="Pregúntale a IRB sobre esta clase">
      <span className="ai-dock-in">
        <span className="iso" aria-hidden="true" />
        <span className="stack" style={{ minWidth: 0 }}>
          <span>Pregúntale a IRB</span>
          <span className="t-label-s c-variant" style={{ fontWeight: 500 }}>
            Sobre esta clase
          </span>
        </span>
        <Icon name="auto_awesome" className="c-variant" style={{ marginLeft: 'auto' }} />
      </span>
    </button>
  );
}

/** Panel "Pregúntale a IRB": entra desde translateY(-100%) en .28s; solo responde sobre la clase abierta. */
export function AskPanel({ onClose }: { onClose: () => void }) {
  const { lesson } = useLessonCtx();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => setMsgs([]), [lesson.id]);
  useEffect(() => list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }), [msgs]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setQ('');
    setMsgs((x) => [...x, { me: true, text: question }]);
    setBusy(true);
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lessonId: lesson.id, question }) });
      const d = (await r.json()) as { answer?: string; error?: string };
      setMsgs((x) => [...x, { me: false, text: d.answer ?? (r.status === 429 ? 'Vamos con calma: intenta de nuevo en unos minutos.' : 'No pude responder ahora. Intenta de nuevo.') }]);
    } catch {
      setMsgs((x) => [...x, { me: false, text: 'Sin conexión. Intenta de nuevo cuando vuelva la señal.' }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <m.section className="ai-panel" role="dialog" aria-label="Pregúntale a IRB" initial={{ y: '-100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-100%', opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}>
      <div className="panel-head">
        <span className="iso sm" aria-hidden="true" />
        <span className="stack" style={{ flex: 1, minWidth: 0 }}>
          <b className="t-card">Pregúntale a IRB</b>
          <span className="t-label-s c-variant">Solo puedo responder sobre esta práctica</span>
        </span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
          <Icon name="close" />
        </button>
      </div>
      <div className="ai-msgs" ref={list} aria-live="polite">
        {!msgs.length && (
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            <p className="t-body-m c-variant">Pregunta lo que quieras sobre «{lesson.title}». Respondo con el material de esta clase.</p>
            {SUGGEST.map((s) => (
              <button key={s} type="button" className="chip" style={{ alignSelf: 'flex-start', height: 'auto', minHeight: 32, padding: '6px 12px', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => void ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((x, i) => (
          <div key={i} className={`ai-msg ${x.me ? 'me' : 'bot'}`}>
            {x.text}
          </div>
        ))}
        {busy && (
          <div className="ai-msg bot" aria-label="Escribiendo">
            <span className="skeleton" style={{ display: 'inline-block', width: 48, height: 10, borderRadius: 5 }} />
          </div>
        )}
      </div>
      <form className="ai-input" onSubmit={(e) => (e.preventDefault(), void ask(q))}>
        <textarea
          rows={1}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void ask(q))}
          placeholder="Escribe tu pregunta"
          aria-label="Tu pregunta"
          maxLength={600}
          autoFocus
        />
        <button type="submit" className={btn('primary', 'lg', 'icon')} aria-label="Enviar" disabled={!q.trim() || busy}>
          <Icon name="send" fill />
        </button>
      </form>
    </m.section>
  );
}
