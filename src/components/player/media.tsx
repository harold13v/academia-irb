'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BLUR } from '@/lib/blur';
import { fmt } from '@/lib/fmt';
import { track } from '@/server/actions';
import { Icon, Tag, btn } from '../sin/ui';
import { lsPut, useLessonCtx, type LessonData } from '../lesson/context';
import { EndScreen } from './endscreen';
import { LessonLink } from './nav';

/** Bandera: título de la clase sobre el video (Platzi lo tiene detrás de un experimento). */
const TITLE_OVER_VIDEO = process.env.NEXT_PUBLIC_TITLE_OVER_VIDEO === '1';
export const SPEEDS = [0.5, 0.85, 1, 1.25, 1.5, 1.75, 2];
const AUTOSTART = 'irb-autostart';

/* ───────────── progreso: pings verificados en el servidor (igual que la Fase 1) ───────────── */

function useProgressReporter() {
  const { lesson, setTime, setPlaying, setDone, done, setClosing } = useLessonCtx();
  const seq = useRef(0);
  const last = useRef(0);
  const pos = useRef(0);
  const doneRef = useRef(done);
  doneRef.current = done;

  const ping = useCallback(
    (position: number, playing: boolean, beacon = false) => {
      if (lesson.locked) return;
      const body = JSON.stringify({ lessonId: lesson.id, position, playing, seq: seq.current++ });
      if (beacon && navigator.sendBeacon) navigator.sendBeacon('/api/progress', new Blob([body], { type: 'application/json' }));
      else void fetch('/api/progress', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
      if (!lesson.signedIn) lsPut(lesson, 'pos', { t: position, updated: Date.now() });
    },
    [lesson],
  );

  useEffect(() => {
    const vis = () => document.hidden && pos.current > 0 && ping(pos.current, true, true);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [ping]);

  return {
    onPlay: (t: number) => {
      setPlaying(true);
      pos.current = t;
      last.current = Date.now();
      ping(t, false);
    },
    onTime: (t: number, percent: number) => {
      pos.current = t;
      setTime(t);
      if (Date.now() - last.current >= 5000) {
        last.current = Date.now();
        ping(t, true);
      }
      if (percent >= 0.95 && !doneRef.current) {
        doneRef.current = true;
        setDone(true);
      }
    },
    onPause: (t: number) => {
      setPlaying(false);
      ping(t, true);
    },
    onEnded: () => {
      setPlaying(false);
      ping(pos.current, true);
      if (!doneRef.current) setDone(true);
      setClosing(true);
    },
  };
}

/* ───────────── motores: Vimeo (controls=0 + @vimeo/player) y SoundCloud (Widget API) ───────────── */

type Track = { language: string; label: string; kind: string };
type St = {
  ready: boolean; loading: boolean; blocked: boolean; playing: boolean; t: number; d: number; buf: number; vol: number; muted: boolean;
  rate: number; rateOk: boolean; tracks: Track[]; cc: string | null; chapters: { startTime: number; title: string }[]; pipOk: boolean;
};
const ST0: St = { ready: false, loading: false, blocked: false, playing: false, t: 0, d: 0, buf: 0, vol: 1, muted: false, rate: 1, rateOk: false, tracks: [], cc: null, chapters: [], pipOk: false };

type Engine = {
  play: () => void; pause: () => void; seek: (t: number) => void; volume: (v: number) => void; mute: (m: boolean) => void;
  rate?: (r: number) => Promise<boolean>; captions?: (lang: string | null) => void; pip?: () => void; id: string;
};
type Rep = ReturnType<typeof useProgressReporter>;
type VimeoPlayer = import('@vimeo/player').default;

const vimeoSrc = (l: LessonData) =>
  `https://player.vimeo.com/video/${l.vimeoId}?${l.vimeoHash ? `h=${l.vimeoHash}&` : ''}controls=0&dnt=1&playsinline=1&keyboard=0&title=0&byline=0&portrait=0&autopause=0`;

const timeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

async function startVimeo(box: HTMLDivElement, l: LessonData, set: (p: Partial<St>) => void, rep: React.RefObject<Rep>): Promise<Engine | null> {
  const { default: Player } = await import('@vimeo/player'); // el SDK llega solo al tocar play
  const f = document.createElement('iframe');
  f.src = vimeoSrc(l);
  f.className = 'embed-iframe';
  f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
  f.title = l.title;
  f.tabIndex = -1;
  box.appendChild(f);
  const p: VimeoPlayer = new Player(f);
  try {
    // si el dominio no está autorizado en Vimeo, ready() nunca llega: nunca dejamos un iframe roto a la vista
    await timeout(p.ready(), 9000);
  } catch {
    f.remove();
    void p.destroy().catch(() => {});
    set({ blocked: true, loading: false });
    return null;
  }
  const [d, tracks, chapters, vol] = await Promise.all([
    p.getDuration().catch(() => l.durationS),
    p.getTextTracks().catch(() => [] as Track[]),
    p.getChapters().catch(() => []),
    p.getVolume().catch(() => 1),
  ]);
  // setPlaybackRate solo existe en cuentas PRO/Business con controls=0: si falla, se oculta el menú de velocidad
  const rateOk = await p.setPlaybackRate(1).then(() => true, () => false);
  (window as unknown as { __irbRateOk?: boolean }).__irbRateOk = rateOk;
  set({ ready: true, loading: false, d, tracks: tracks as Track[], chapters: chapters as St['chapters'], vol, rateOk, pipOk: !!document.pictureInPictureEnabled });
  p.on('play', (e: { seconds: number }) => (set({ playing: true }), rep.current.onPlay(e.seconds)));
  p.on('pause', (e: { seconds: number }) => (set({ playing: false }), rep.current.onPause(e.seconds)));
  p.on('timeupdate', (e: { seconds: number; percent: number; duration: number }) => (set({ t: e.seconds, d: e.duration }), rep.current.onTime(e.seconds, e.percent)));
  p.on('progress', (e: { percent: number }) => set({ buf: e.percent }));
  p.on('ended', () => (set({ playing: false }), rep.current.onEnded()));
  p.on('volumechange', (e: { volume: number }) => set({ vol: e.volume }));
  p.on('playbackratechange', (e: { playbackRate: number }) => set({ rate: e.playbackRate }));
  p.on('texttrackchange', (e: { language: string | null }) => set({ cc: e.language }));
  return {
    id: String(l.vimeoId),
    play: () => void p.play().catch(() => {}),
    pause: () => void p.pause().catch(() => {}),
    seek: (t) => void p.setCurrentTime(Math.max(0, t)).catch(() => {}),
    volume: (v) => void p.setVolume(v).catch(() => {}),
    mute: (m) => void p.setMuted(m).catch(() => {}),
    rate: rateOk ? (r) => p.setPlaybackRate(r).then(() => true, () => false) : undefined,
    captions: (tracks as Track[]).length ? (lang) => void (lang ? p.enableTextTrack(lang) : p.disableTextTrack()).catch(() => {}) : undefined,
    pip: () => void p.requestPictureInPicture().catch(() => {}),
  };
}

type SCWidget = {
  bind: (e: string, cb: (d: { currentPosition: number; relativePosition: number; loadedProgress?: number }) => void) => void;
  play: () => void; pause: () => void; seekTo: (ms: number) => void; setVolume: (v: number) => void; getDuration: (cb: (ms: number) => void) => void;
};
type SCApi = { Widget: ((el: HTMLIFrameElement) => SCWidget) & { Events: Record<string, string> } };

async function startSoundCloud(box: HTMLDivElement, l: LessonData, at: number, set: (p: Partial<St>) => void, rep: React.RefObject<Rep>): Promise<Engine | null> {
  const w = window as unknown as { SC?: SCApi };
  if (!w.SC)
    await new Promise<void>((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://w.soundcloud.com/player/api.js';
      s.onload = () => res();
      s.onerror = rej;
      document.head.appendChild(s);
    });
  const f = document.createElement('iframe');
  f.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(l.mediaUrl ?? '')}&auto_play=true&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`;
  f.allow = 'autoplay; encrypted-media';
  f.title = `Audio: ${l.title}`;
  f.tabIndex = -1;
  f.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;inset:auto';
  box.appendChild(f);
  const SC = w.SC!;
  const widget = SC.Widget(f);
  await new Promise<void>((res) => widget.bind(SC.Widget.Events.READY!, () => res()));
  widget.getDuration((ms) => set({ d: ms / 1000 }));
  if (at > 0) widget.seekTo(at * 1000);
  set({ ready: true, loading: false });
  widget.bind(SC.Widget.Events.PLAY!, (d) => (set({ playing: true }), rep.current.onPlay(d.currentPosition / 1000)));
  widget.bind(SC.Widget.Events.PAUSE!, (d) => (set({ playing: false }), rep.current.onPause(d.currentPosition / 1000)));
  widget.bind(SC.Widget.Events.PLAY_PROGRESS!, (d) => (set({ t: d.currentPosition / 1000 }), rep.current.onTime(d.currentPosition / 1000, d.relativePosition)));
  widget.bind(SC.Widget.Events.LOAD_PROGRESS!, (d) => set({ buf: d.loadedProgress ?? 0 }));
  widget.bind(SC.Widget.Events.FINISH!, () => (set({ playing: false }), rep.current.onEnded()));
  // controles desde la pantalla bloqueada
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: l.title, artist: 'Ximena Duque Valencia', album: l.courseTitle, artwork: l.cover ? [{ src: l.cover, sizes: '512x512' }] : [] });
    navigator.mediaSession.setActionHandler('play', () => widget.play());
    navigator.mediaSession.setActionHandler('pause', () => widget.pause());
  }
  let vol = 1;
  return {
    id: l.mediaUrl ?? '',
    play: () => widget.play(),
    pause: () => widget.pause(),
    seek: (t) => widget.seekTo(Math.max(0, t) * 1000),
    volume: (v) => (widget.setVolume(v * 100), (vol = v), set({ vol: v, muted: v === 0 })),
    mute: (m) => (widget.setVolume(m ? 0 : vol * 100), set({ muted: m })),
  };
}

/* ───────────── línea de tiempo segmentada (capítulos) ───────────── */

function Timeline({ st, onSeek }: { st: St; onSeek: (t: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const d = Math.max(1, st.d);
  const t = drag ?? st.t;
  const segs = st.chapters.length > 1 ? st.chapters.map((c, i) => ({ a: c.startTime, b: st.chapters[i + 1]?.startTime ?? d, title: c.title })) : [{ a: 0, b: d, title: '' }];
  const at = (x: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (x - r.left) / r.width)) * d;
  };
  const seg = (s: number) => segs.find((g) => s >= g.a && s < g.b);
  return (
    <div
      ref={ref}
      className="tl"
      data-drag={drag !== null}
      role="slider"
      tabIndex={0}
      aria-label="Línea de tiempo"
      aria-valuemin={0}
      aria-valuemax={Math.round(d)}
      aria-valuenow={Math.round(t)}
      aria-valuetext={`${fmt(t)} de ${fmt(d)}`}
      onPointerDown={(e) => {
        try {
          ref.current!.setPointerCapture(e.pointerId);
        } catch {}
        setDrag(at(e.clientX));
      }}
      onPointerMove={(e) => (setHover(at(e.clientX)), drag !== null && setDrag(at(e.clientX)))}
      onPointerUp={(e) => (drag !== null && onSeek(at(e.clientX)), setDrag(null))}
      onPointerLeave={() => setHover(null)}
    >
      {segs.map((g) => (
        <div key={g.a} className="tl-seg" style={{ flex: `${g.b - g.a} 1 0` }}>
          <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, (st.buf * d - g.a) / (g.b - g.a)))})` }} />
          <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, (t - g.a) / (g.b - g.a)))})` }} />
        </div>
      ))}
      <span className="tl-thumb" style={{ left: `${(t / d) * 100}%` }} />
      {hover !== null && (
        <span className="tl-tip tnum" style={{ left: `${Math.max(4, Math.min(96, (hover / d) * 100))}%` }}>
          {seg(hover)?.title ? `${seg(hover)!.title} · ` : ''}
          {fmt(hover)}
        </span>
      )}
    </div>
  );
}

/* ───────────── tarjeta de video: póster, glow, scrims, overlay y fin ───────────── */

function Poster({ src, priority }: { src: string | null; priority?: boolean }) {
  if (!src) return null;
  return (
    <>
      <div className="ambient" aria-hidden="true">
        <Image src={src} alt="" fill sizes="64px" quality={30} />
      </div>
      <div className="poster" aria-hidden="true">
        <Image src={src} alt="" fill priority={priority} sizes="(min-width: 1024px) 70vw, 100vw" placeholder="blur" blurDataURL={BLUR} style={{ objectFit: 'cover' }} />
      </div>
    </>
  );
}

function Notice({ icon, tag, title, children }: { icon: string; tag?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="dev-notice">
      <div className="card glass">
        <Icon name={icon} size={28} />
        {tag && <Tag tone="warning">{tag}</Tag>}
        <b className="t-card">{title}</b>
        {children}
      </div>
    </div>
  );
}

export function VideoCard({ soundOn, onRequestNext }: { soundOn: boolean; onRequestNext?: () => void }) {
  const { lesson, time, done, player, setStarted, closing } = useLessonCtx();
  const wrap = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const eng = useRef<Engine | null>(null);
  const [st, setSt] = useState<St>(ST0);
  const set = useCallback((p: Partial<St>) => setSt((s) => ({ ...s, ...p })), []);
  const [idle, setIdle] = useState(false);
  const [fs, setFs] = useState(false);
  const idleT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const rep = useProgressReporter();
  const repRef = useRef(rep);
  repRef.current = rep;
  const media = lesson.mediaType;
  const custom = (media === 'vimeo' || media === 'soundcloud') && lesson.playable && !lesson.locked;
  const [ytOn, setYtOn] = useState(false);
  const cover = lesson.poster ?? lesson.cover;

  const start = useCallback(
    async (at: number) => {
      setStarted(true);
      void track('lesson_play', { lessonId: lesson.id });
      const key = media === 'vimeo' ? String(lesson.vimeoId) : (lesson.mediaUrl ?? '');
      if (eng.current && eng.current.id === key) {
        eng.current.seek(at);
        eng.current.play();
        return;
      }
      box.current!.replaceChildren();
      eng.current = null;
      set({ ...ST0, loading: true, d: lesson.durationS });
      try {
        const e = media === 'vimeo' ? await startVimeo(box.current!, lesson, set, repRef) : await startSoundCloud(box.current!, lesson, at, set, repRef);
        if (!e) return;
        eng.current = e;
        if (media === 'vimeo') {
          if (at > 0) e.seek(at);
          e.play();
        }
      } catch {
        set({ loading: false, blocked: media === 'vimeo' });
      }
    },
    [lesson, media, set, setStarted],
  );

  useEffect(() => {
    player.current = { seek: (t) => (eng.current ? eng.current.seek(t) : void start(t)), play: (t) => void start(t ?? 0), pause: () => eng.current?.pause() };
  }, [player, start]);

  // cambio de clase: el reproductor sigue montado; la nueva clase espera el clic, salvo que venga de la cuenta regresiva
  useEffect(() => {
    eng.current?.pause();
    box.current?.replaceChildren();
    eng.current = null;
    setSt(ST0);
    setYtOn(false);
    let auto = false;
    try {
      auto = sessionStorage.getItem(AUTOSTART) === lesson.slug;
      sessionStorage.removeItem(AUTOSTART);
    } catch {}
    if (auto && custom) void start(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // overlay: se oculta tras 2,5 s (2 s en táctil) mientras reproduce
  const poke = useCallback(
    (touch = false) => {
      setIdle(false);
      clearTimeout(idleT.current);
      idleT.current = setTimeout(() => setIdle(true), touch ? 2000 : 2500);
    },
    [],
  );
  useEffect(() => {
    if (!st.playing) (clearTimeout(idleT.current), setIdle(false));
    else poke();
  }, [st.playing, poke]);

  useEffect(() => {
    const on = () => setFs(document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFs = () => (document.fullscreenElement ? void document.exitFullscreen() : void wrap.current?.requestFullscreen?.().catch(() => {}));
  const toggle = () => (st.playing ? eng.current?.pause() : eng.current ? eng.current.play() : void start(resume ? time : 0));
  const rateStep = (dir: 1 | -1) => {
    const i = SPEEDS.indexOf(st.rate);
    const r = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 2 : i) + dir))]!;
    void eng.current?.rate?.(r);
  };
  const cc = () => {
    if (!eng.current?.captions) return;
    eng.current.captions(st.cc ? null : (st.tracks.find((x) => x.language.startsWith('es')) ?? st.tracks[0])!.language);
  };

  // atajos del reproductor
  const stRef = useRef(st);
  stRef.current = st;
  useEffect(() => {
    if (!custom) return;
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || document.querySelector('[role=dialog]')) return;
      const s = stRef.current;
      const E = eng.current;
      const key = e.key;
      const hit = (fn: () => void) => (e.preventDefault(), fn(), poke());
      if (key === ' ' || key === 'k') hit(toggle);
      else if (!E) return;
      else if (key === 'ArrowLeft') hit(() => E.seek(s.t - 5));
      else if (key === 'ArrowRight') hit(() => E.seek(s.t + 5));
      else if (key === 'j') hit(() => E.seek(s.t - 10));
      else if (key === 'l') hit(() => E.seek(s.t + 10));
      else if (key === 'ArrowUp') hit(() => E.volume(Math.min(1, s.vol + 0.1)));
      else if (key === 'ArrowDown') hit(() => E.volume(Math.max(0, s.vol - 0.1)));
      else if (key === 'm') hit(() => E.mute(!s.muted));
      else if (key === 'f') hit(toggleFs);
      else if (key === 'c') hit(cc);
      else if (key === '>' || key === '.') hit(() => rateStep(1));
      else if (key === '<' || key === ',') hit(() => rateStep(-1));
      else if (key === 'n' && onRequestNext) hit(onRequestNext);
      else if (/^[0-9]$/.test(key)) hit(() => E.seek((Number(key) / 10) * s.d));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const resume = time > 30 && time < lesson.durationS - 60 && !done;
  const begun = st.loading || st.ready;
  const label = resume ? `Continuar desde ${fmt(time)}` : lesson.kind === 'practice' ? 'Empezar práctica' : media === 'soundcloud' ? 'Escuchar audio' : 'Reproducir clase';

  /* ── variantes sin overlay propio ── */
  if (lesson.locked)
    return (
      <div className="vcard" id="video">
        <Poster src={cover} priority />
        <div className="scrim-bottom" />
        <Notice icon="lock" title={`Esta clase es parte de ${lesson.courseTitle}`}>
          <p className="t-body-m c-variant">{lesson.signedIn ? 'Tu cuenta todavía no tiene acceso a este curso.' : 'Entra con tu cuenta para ver si ya tienes acceso.'}</p>
          {lesson.signedIn ? (
            <a className={btn('primary')} href="https://indigoacademy.digital/" rel="noopener">
              Conocer el curso
            </a>
          ) : (
            <a className={btn('primary')} href={`/entrar?next=${encodeURIComponent(`${lesson.basePath}/${lesson.slug}`)}`}>
              Entrar
            </a>
          )}
        </Notice>
      </div>
    );
  if (media === 'youtube') {
    const id = lesson.mediaUrl?.match(/v=([\w-]+)/)?.[1];
    return (
      <div className="vcard" id="video">
        {ytOn && id ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`} title={lesson.title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />
        ) : (
          <>
            <Poster src={id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : cover} priority />
            <button type="button" className="big-play" aria-label="Reproducir video" onClick={() => (setYtOn(true), setStarted(true))}>
              <Icon name="play_arrow" fill />
            </button>
          </>
        )}
      </div>
    );
  }
  if (media === 'spotify') {
    const src = lesson.mediaUrl?.replace('open.spotify.com/', 'open.spotify.com/embed/');
    return (
      <div className="vcard" id="video">
        <Poster src={cover} />
        <div className="dev-notice">
          {src && <iframe src={`${src}?theme=0`} title={`Spotify: ${lesson.title}`} allow="encrypted-media" loading="lazy" style={{ position: 'relative', width: 'min(520px, 100%)', height: 152, borderRadius: 12 }} />}
        </div>
      </div>
    );
  }
  if (media === 'gdoc') {
    const src = lesson.mediaUrl?.replace(/\/(edit|view)(\?[^#]*)?(#.*)?$/, '/preview');
    return (
      <div className="vcard" id="video" style={{ background: 'var(--sin-surface-container)' }}>
        {src && <iframe src={src} title={`Documento: ${lesson.title}`} loading="lazy" style={{ background: 'var(--sin-inverse-surface)' }} />}
      </div>
    );
  }
  if (media === 'texto')
    return (
      <div className="vcard" id="video" style={{ background: 'var(--sin-surface-container)', overflowY: 'auto' }}>
        <div className="prose-irb" style={{ padding: '24px clamp(16px, 5cqw, 48px)', maxWidth: 720, margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: lesson.bodyHtml || '<p>Esta lectura no tiene texto.</p>' }} />
      </div>
    );
  if (media === 'vimeo' && !lesson.playable)
    return (
      <div className="vcard" id="video">
        <Poster src={cover} priority />
        <div className="scrim-bottom" />
        <Notice icon="smart_display" tag="Aviso de desarrollo" title="Video no autorizado en este dominio">
          <p className="t-body-m c-variant">
            Este video se reproduce en indigoacademy.digital. En staging solo está autorizado el video de Fuegos. · {fmt(lesson.durationS)}
          </p>
        </Notice>
      </div>
    );

  /* ── Vimeo / SoundCloud con overlay propio ── */
  return (
    <div
      ref={wrap}
      className="vcard"
      id="video"
      onPointerMove={(e) => st.playing && poke(e.pointerType === 'touch')}
      onPointerDown={(e) => st.playing && poke(e.pointerType === 'touch')}
    >
      {(!begun || media === 'soundcloud' || st.blocked) && <Poster src={cover} priority={!begun} />}
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      {media === 'soundcloud' && begun && (
        <div className="dev-notice" style={{ pointerEvents: 'none' }}>
          <Tag tone="tertiary" icon="music_note" md>
            Audio
          </Tag>
        </div>
      )}
      {st.blocked ? (
        <Notice icon="smart_display" tag="Aviso de desarrollo" title="Video no autorizado en este dominio">
          <p className="t-body-m c-variant">Vimeo no permite reproducir este video en {typeof location !== 'undefined' ? location.hostname : 'este dominio'}. Hay que autorizar el dominio en la configuración de privacidad del video.</p>
        </Notice>
      ) : !begun ? (
        <>
          <div className="scrim-bottom" />
          <button type="button" className="big-play" aria-label={label} onClick={() => void start(resume ? time : 0)}>
            <Icon name="play_arrow" fill />
          </button>
          <span className="start-label tnum">
            {label} · {fmt(lesson.durationS)}
          </span>
        </>
      ) : (
        <div className="vov" data-idle={idle && st.playing}>
          <div className="scrim-top" />
          <div className="scrim-bottom" />
          <button type="button" className="vov-hit" aria-label={st.playing ? 'Pausar' : 'Reproducir'} tabIndex={-1} onClick={(e) => (e.nativeEvent as PointerEvent).pointerType === 'touch' && idle ? poke(true) : toggle()} onDoubleClick={toggleFs} />
          {TITLE_OVER_VIDEO && (
            <div className="vov-top">
              <span className="vov-title clamp1">{lesson.title}</span>
            </div>
          )}
          {st.loading && (
            <div className="dev-notice" style={{ pointerEvents: 'none' }}>
              <span className="skeleton" style={{ width: 56, height: 56, borderRadius: '50%' }} />
            </div>
          )}
          <div className="vov-bottom">
            <Timeline st={st} onSeek={(t) => eng.current?.seek(t)} />
            <div className="vrow">
              <button type="button" className="pbtn play" onClick={toggle} aria-label={st.playing ? 'Pausar' : 'Reproducir'}>
                <Icon name={st.playing ? 'pause' : 'play_arrow'} fill />
              </button>
              <span className="pill pnav">
                <button type="button" className="pbtn" aria-label="Retroceder 10 segundos" onClick={() => eng.current?.seek(st.t - 10)}>
                  <Icon name="replay_10" />
                </button>
                <button type="button" className="pbtn" aria-label="Avanzar 10 segundos" onClick={() => eng.current?.seek(st.t + 10)}>
                  <Icon name="forward_10" />
                </button>
                {lesson.next && (
                  <LessonLink href={`${lesson.basePath}/${lesson.next.slug}`} className="pbtn" aria-label={`Siguiente: ${lesson.next.title}`}>
                    <Icon name="skip_next" fill />
                  </LessonLink>
                )}
              </span>
              <span className="vtime tnum">
                <b>{fmt(st.t)}</b> / {fmt(st.d || lesson.durationS)}
              </span>
              <span className="vol pill hide-sm">
                <button type="button" className="pbtn" aria-label={st.muted || st.vol === 0 ? 'Activar sonido' : 'Silenciar'} onClick={() => eng.current?.mute(!st.muted)}>
                  <Icon name={st.muted || st.vol === 0 ? 'volume_off' : 'volume_up'} />
                </button>
                <input type="range" min={0} max={1} step={0.05} value={st.muted ? 0 : st.vol} aria-label="Volumen" onChange={(e) => eng.current?.volume(Number(e.target.value))} />
              </span>
              <span className="vspacer" />
              {st.tracks.length > 0 && (
                <button type="button" className="pbtn" aria-pressed={!!st.cc} aria-label="Subtítulos" onClick={cc}>
                  <Icon name="closed_caption" fill={!!st.cc} />
                </button>
              )}
              {st.rateOk && (
                <Menu.Root>
                  <Menu.Trigger className="pbtn tnum" aria-label={`Velocidad ${st.rate}x`} style={{ width: 'auto', padding: '0 10px', borderRadius: 18, font: '600 13px/1 var(--font-jakarta)' }}>
                    {st.rate}x
                  </Menu.Trigger>
                  <Menu.Portal container={fs ? wrap.current : undefined}>
                    <Menu.Content className="menu" side="top" align="end" sideOffset={8} onCloseAutoFocus={(e) => e.preventDefault()}>
                      <Menu.Label className="menu-label t-overline c-variant">Velocidad</Menu.Label>
                      <Menu.RadioGroup value={String(st.rate)} onValueChange={(v) => void eng.current?.rate?.(Number(v))}>
                        {SPEEDS.map((r) => (
                          <Menu.RadioItem key={r} value={String(r)} className="menu-item tnum">
                            <Menu.ItemIndicator>
                              <Icon name="check" />
                            </Menu.ItemIndicator>
                            <span style={{ marginLeft: st.rate === r ? 0 : 28 }}>{r === 1 ? 'Normal' : `${r}x`}</span>
                          </Menu.RadioItem>
                        ))}
                      </Menu.RadioGroup>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu.Root>
              )}
              {media === 'vimeo' && st.pipOk && (
                <button type="button" className="pbtn hide-sm" aria-label="Imagen en imagen" onClick={() => eng.current?.pip?.()}>
                  <Icon name="picture_in_picture_alt" />
                </button>
              )}
              {media === 'vimeo' && (
                <button type="button" className="pbtn" aria-label={fs ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={toggleFs}>
                  <Icon name={fs ? 'fullscreen_exit' : 'fullscreen'} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {closing && <EndScreen soundOn={soundOn} onReplay={() => void start(0)} />}
    </div>
  );
}

export { AUTOSTART };
