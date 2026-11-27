'use client';

import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { AnimatePresence, m, useDragControls } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { fmt } from '@/lib/fmt';
import type { Delta } from '../live';
import { useLive, useLiveChannels } from '../live';
import { useLessonCtx } from '../lesson/context';
import { ReminderSheet } from '../sin/reminder';
import { UserMenu, useShell } from '../sin/shell';
import { StreakPill } from '../sin/streak';
import { ClassRow } from '../sin/syllabus';
import { useUnread } from '../sin/notifications';
import { CoverArt, Icon, Isotype, Progress, btn } from '../sin/ui';
import { AskDock, AskPanel } from './ask';
import { Comments } from './comments';
import { VideoCard } from './media';
import { daysLeft, EVENT, ics, LessonLink, trackReg, useLessonNav, useRegHref } from './nav';
import { Resources } from './resources';
import type { OutlineView, PlayerUser, Prog } from './types';

/* ───────────── temario de la clase (panel Clases y drawer móvil) ───────────── */

function ClassList({ outline, progress, onPick }: { outline: OutlineView; progress: Prog; onPick?: () => void }) {
  const { lesson, done } = useLessonCtx();
  let n = 0;
  const prog = { ...progress, [lesson.id]: { ...(progress[lesson.id] ?? { positionS: 0, percent: 0 }), completed: done } };
  return (
    <div className="stack" style={{ gap: 2 }}>
      {outline.modules.map((mod) => (
        <div key={mod.id}>
          {outline.modules.length > 1 && (
            <p className="t-overline c-variant" style={{ padding: '12px 8px 4px' }}>
              {mod.title}
            </p>
          )}
          {mod.lessons.map((l) => {
            n++;
            const cur = l.id === lesson.id;
            const row = <ClassRow n={n} l={l} cover={outline.cover} p={prog[l.id]} current={cur} locked={lesson.locked && !l.isFree} />;
            return cur ? (
              <div key={l.id} onClick={onPick}>
                {row}
              </div>
            ) : (
              <LessonLink key={l.id} href={`${lesson.basePath}/${l.slug}`} onClick={onPick} style={{ display: 'block' }}>
                {row}
              </LessonLink>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CourseProgressHead({ outline, progress }: { outline: OutlineView; progress: Prog }) {
  const { lesson, done } = useLessonCtx();
  const count = Object.entries(progress).filter(([id, p]) => Number(id) !== lesson.id && p.completed).length + (done ? 1 : 0);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row-c" style={{ justifyContent: 'space-between' }}>
        <b className="t-label-l">Progreso del curso</b>
        <span className="t-label-m c-variant tnum">
          {count}/{outline.count}
        </span>
      </div>
      <Progress value={count / Math.max(1, outline.count)} label="Progreso del curso" />
    </div>
  );
}

/** Drawer "Progreso del curso": sheet de 70dvh en móvil (Radix Dialog + arrastre con Motion). */
function ClassDrawer({ open, onOpenChange, outline, progress }: { open: boolean; onOpenChange: (v: boolean) => void; outline: OutlineView; progress: Prog }) {
  const drag = useDragControls();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <m.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
              <m.div
                className="sheet glass"
                style={{ height: '70dvh' }}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.34, ease: [0.32, 0.72, 0, 1] }}
                drag="y"
                dragControls={drag}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 500) && onOpenChange(false)}
              >
                <div onPointerDown={(e) => drag.start(e)} style={{ touchAction: 'none', padding: '0 16px 12px', cursor: 'grab' }}>
                  <div className="sheet-grip" />
                  <Dialog.Title className="sr-only">Progreso del curso</Dialog.Title>
                  <CourseProgressHead outline={outline} progress={progress} />
                </div>
                <div className="rscroll" style={{ paddingTop: 0 }}>
                  <ClassList outline={outline} progress={progress} onPick={() => onOpenChange(false)} />
                </div>
              </m.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/* ───────────── barra de clase (debajo del video) ───────────── */

function ClassBar({ outline, onDrawer, onResources }: { outline: OutlineView; onDrawer: () => void; onResources: () => void }) {
  const { lesson, done, setDone } = useLessonCtx();
  const regHref = useRegHref();
  return (
    <div className="classbar">
      <span className="cb-badge" aria-hidden="true">
        <CoverArt title={outline.title} small />
        {outline.cover && <Image src={outline.cover} alt="" fill sizes="48px" />}
      </span>
      <div className="stack" style={{ minWidth: 0, flex: 1 }}>
        <h1 className="cb-title clamp2">{lesson.title}</h1>
        <span className="t-label-s c-variant tnum clamp1">
          {lesson.kind === 'practice' ? 'Práctica guiada' : `Clase ${lesson.index + 1} de ${lesson.total}`} · {fmt(lesson.durationS)}
          {done ? ' · Completada' : ''}
        </span>
      </div>
      <div className="cb-actions">
        {!lesson.locked && lesson.kind === 'course' && (
          <button type="button" className={btn(done ? 'tonal' : 'tertiary', 'md', 'hide-sm')} onClick={() => setDone(!done)} aria-pressed={done}>
            <Icon name="check_circle" fill={done} /> {done ? 'Completada' : 'Marcar completada'}
          </button>
        )}
        {lesson.kind === 'practice' ? (
          <>
            <span className="cb-live hide-sm tnum">
              <span className="live-dot" aria-hidden="true" />
              <span className="stack">
                <b>En vivo · Mar 1 dic · 7:00 p. m.</b>
                <span>{EVENT.title}</span>
              </span>
            </span>
            <a className={btn('primary', 'md', 'hide-sm cta-glow')} href={regHref} onClick={trackReg}>
              Reservar mi lugar <Icon name="arrow_forward" />
            </a>
          </>
        ) : (
          <button type="button" className={btn('tertiary', 'md')} onClick={onDrawer} aria-label="Progreso del curso">
            <Icon name="playlist_play" /> <span className="hide-sm">Clases</span>
          </button>
        )}
        {lesson.next && lesson.kind === 'course' && (
          <LessonLink href={`${lesson.basePath}/${lesson.next.slug}`} className={btn('primary', 'md', 'hide-sm')}>
            Siguiente <Icon name="arrow_forward" />
          </LessonLink>
        )}
      </div>
      <button type="button" className={btn('glass', 'md', 'res-pill')} onClick={onResources}>
        Recursos <Icon name="expand_more" />
      </button>
    </div>
  );
}

/* ───────────── Fuegos: siguiente paso hacia FAM 2027 (enlace intacto) ───────────── */

function FamCard() {
  const regHref = useRegHref();
  const [left, setLeft] = useState('');
  useEffect(() => setLeft(daysLeft()), []);
  return (
    <div className="fam-cta">
      <p className="fam-over">
        <span className="live-dot" aria-hidden="true" /> Siguiente paso · En vivo
      </p>
      <h3 className="t-card" style={{ marginTop: 4 }}>
        {EVENT.title}
      </h3>
      <p className="t-body-m c-variant" style={{ marginTop: 4 }}>
        Martes 1 de diciembre de 2026 · 7:00 p. m. hora Colombia · En vivo por Zoom
      </p>
      {left && (
        <p className="t-label-l c-primary tnum" style={{ marginTop: 8 }}>
          {left}
        </p>
      )}
      <a className={btn('primary', 'lg', 'wide')} href={regHref} onClick={trackReg} style={{ marginTop: 12 }}>
        Reservar mi lugar
      </a>
      <button className={btn('plain', 'md', 'wide')} type="button" onClick={ics} style={{ marginTop: 4 }}>
        <Icon name="calendar_month" /> Agregar a mi calendario
      </button>
    </div>
  );
}

function MobileFamBar() {
  const { playing } = useLessonCtx();
  const regHref = useRegHref();
  const [left, setLeft] = useState('');
  useEffect(() => setLeft(daysLeft()), []);
  return (
    <div className="mcta" data-off={playing}>
      <span className="stack" style={{ flex: 1, minWidth: 0 }}>
        <b className="t-label-l">Mar 1 dic · En vivo</b>
        <span className="t-label-s c-variant">{left}</span>
      </span>
      <a className={btn('primary', 'md', 'cta-glow')} href={regHref} onClick={trackReg}>
        Reservar mi lugar
      </a>
    </div>
  );
}

/* ───────────── página del reproductor ───────────── */

/** kiosk: enlace público de Fuegos. Sin navegación hacia el resto de la plataforma (sin menú, buscador, volver, comentarios ni login). */
export function PlayerPage({ outline, progress, user, kiosk = false }: { outline: OutlineView; progress: Prog; user: PlayerUser; kiosk?: boolean }) {
  const { lesson } = useLessonCtx();
  const shell = useShell();
  const router = useRouter();
  const go = useLessonNav();
  const [tab, setTab] = useState(lesson.kind === 'practice' ? 'recursos' : 'clases');
  const [drawer, setDrawer] = useState(false);
  const [ask, setAsk] = useState(false);
  const [remind, setRemind] = useState(false);
  const presence = useLive((s) => s.presence);
  const unread = useUnread(shell?.data.unread ?? 0);
  useLiveChannels({ practice: lesson.isFree ? lesson.id : undefined });

  useEffect(() => {
    if (lesson.next) router.prefetch(`${lesson.basePath}/${lesson.next.slug}`);
  }, [lesson, router]);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('ask') === '1') setAsk(true);
  }, []);
  // después de la primera práctica guardada: elegir hora de recordatorio (se pregunta una vez)
  useEffect(() => {
    if (!user || user.reminderHour !== null) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<Delta>).detail;
      let asked = false;
      try {
        asked = !!localStorage.getItem('irb-reminder-asked');
        localStorage.setItem('irb-reminder-asked', '1');
      } catch {}
      if (!asked && d.daysPracticed >= 1) setRemind(true);
    };
    window.addEventListener('irb:practice-closed', on);
    return () => window.removeEventListener('irb:practice-closed', on);
  }, [user]);

  const toResources = useCallback(() => {
    setTab('recursos');
    document.getElementById('rpanel')?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  const openDrawer = () => (window.matchMedia('(min-width: 1024px)').matches ? setTab('clases') : setDrawer(true));
  const back = lesson.kind === 'practice' ? '/' : `/cursos/${lesson.courseSlug}`;

  return (
    <div className="player-page">
      <header className="pp-info">
        {kiosk ? (
          <span style={{ padding: '0 8px', display: 'grid' }}>
            <Isotype size={28} />
          </span>
        ) : (
          <Link href={back} className="icon-btn" aria-label={lesson.kind === 'practice' ? 'Ir al inicio' : `Volver a ${outline.title}`}>
            <Icon name="arrow_back" />
          </Link>
        )}
        <span className="stack" style={{ minWidth: 0, flex: 1 }}>
          <span className="t-label-l clamp1">{lesson.kind === 'practice' ? 'Práctica guiada' : outline.title}</span>
          {presence !== null && presence > 1 && (
            <span className="t-label-s c-variant" aria-live="polite">
              {presence} personas practicando ahora
            </span>
          )}
        </span>
        {shell && (
          <button type="button" className="icon-btn" onClick={shell.openSearch} aria-label="Buscar">
            <Icon name="search" />
          </button>
        )}
        {shell?.data.user && (
          <>
            {shell.data.streak && <StreakPill streak={shell.data.streak} />}
            <button type="button" className="icon-btn" onClick={shell.openNotifs} aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}>
              <Icon name="notifications" />
              {unread > 0 && <span className="dot-badge tnum">{unread > 9 ? '9+' : unread}</span>}
            </button>
            <UserMenu name={shell.data.user.name} />
          </>
        )}
        {!kiosk && !shell?.data.user && (
          <Link href={`/entrar?next=${encodeURIComponent(`${lesson.basePath}/${lesson.slug}`)}`} className={btn('tertiary', 'sm')}>
            Entrar
          </Link>
        )}
      </header>

      <main className="pp-main">
        {(lesson.poster ?? lesson.cover) && (
          <div className="glow-back" aria-hidden="true">
            <Image src={(lesson.poster ?? lesson.cover)!} alt="" fill sizes="64px" quality={30} />
          </div>
        )}
        <VideoCard soundOn={!!user?.soundOn} onRequestNext={lesson.next ? () => go(`${lesson.basePath}/${lesson.next!.slug}`) : undefined} />
      </main>

      <div className="pp-classbar">
        <ClassBar outline={outline} onDrawer={openDrawer} onResources={toResources} />
      </div>

      <aside className="pp-tabs" aria-label="Clases, comentarios y recursos">
        <div className="rpanel" id="rpanel">
          <AnimatePresence>{ask && <AskPanel onClose={() => setAsk(false)} />}</AnimatePresence>
          <Tabs.Root value={tab} onValueChange={setTab} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <Tabs.List className="rtabs" aria-label="Panel de la clase">
              <Tabs.Trigger value="clases" className="rtab">
                Clases
                {tab === 'clases' && <m.span layoutId="rtab-ind" className="rtab-ind" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />}
              </Tabs.Trigger>
              {!kiosk && <Tabs.Trigger value="comentarios" className="rtab">
                Comentarios
                {tab === 'comentarios' && <m.span layoutId="rtab-ind" className="rtab-ind" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />}
              </Tabs.Trigger>}
              <Tabs.Trigger value="recursos" className="rtab">
                Recursos
                {tab === 'recursos' && <m.span layoutId="rtab-ind" className="rtab-ind" transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />}
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="clases" className="rscroll">
              <div style={{ padding: '4px 4px 12px' }}>
                <CourseProgressHead outline={outline} progress={progress} />
              </div>
              <ClassList outline={outline} progress={progress} />
              {lesson.kind === 'practice' && <FamCard />}
            </Tabs.Content>
            {!kiosk && (
              <Tabs.Content value="comentarios" className="rscroll">
                <Comments lessonId={lesson.id} me={user?.name ?? null} locked={lesson.locked} />
              </Tabs.Content>
            )}
            <Tabs.Content value="recursos" className="rscroll">
              <Resources outline={outline} />
              {lesson.kind === 'practice' && <FamCard />}
            </Tabs.Content>
          </Tabs.Root>
          {!lesson.locked && <AskDock onOpen={() => setAsk(true)} />}
        </div>
      </aside>

      <ClassDrawer open={drawer} onOpenChange={setDrawer} outline={outline} progress={progress} />
      {lesson.kind === 'practice' && <MobileFamBar />}
      {user && <ReminderSheet open={remind} onOpenChange={setRemind} />}
    </div>
  );
}
