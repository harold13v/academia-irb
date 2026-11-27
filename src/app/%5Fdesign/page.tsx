'use client';

import { useState } from 'react';
import { LessonProvider, type LessonData } from '@/components/lesson/context';
import type { Delta } from '@/components/live';
import { EndScreen } from '@/components/player/endscreen';
import { VideoCard } from '@/components/player/media';
import { ClassRow } from '@/components/sin/syllabus';
import { StreakCopy, WeekRow } from '@/components/sin/streak';
import { Ticker } from '@/components/sin/motion';
import { Avatar, CoverArt, Empty, Icon, Lotus, Progress, Skeleton, Tag, btn, type BtnVariant } from '@/components/sin/ui';
import { useToast } from '@/components/ui/toast';
import type { WeeklyStreak } from '@/server/social';

const base: LessonData = {
  id: 999001, courseId: 0, courseSlug: 'diseno', courseTitle: 'Curso de ejemplo', kind: 'course', basePath: '/_design', slug: 'ejemplo',
  title: 'Clase de ejemplo', subtitle: 'Así se ve una clase con todos sus elementos', mediaType: 'vimeo', mediaUrl: null, vimeoId: '0', vimeoHash: null,
  poster: null, cover: null, durationS: 1630, bodyHtml: '<h2>Resumen</h2><p>Texto de apoyo de la clase.</p>', prep: [], isFree: false, autoplayNext: true,
  playable: false, locked: false, index: 1, total: 12, prev: { slug: 'a', title: 'Clase anterior' }, next: { slug: 'b', title: 'Clase siguiente' }, signedIn: false, progress: null,
};

const streak = (over: Partial<WeeklyStreak> = {}): WeeklyStreak => ({
  weeks: 6, thisWeekDone: true, totalDays: 41, pausedThisWeek: false, pausesLeftMonth: 1, hidden: false,
  days: (['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const).map((label, i) => ({ day: `2026-11-${23 + i}`, label, state: i < 2 ? 'done' : i === 2 ? 'today' : 'future' })),
  ...over,
});
const riskWeek = streak({ thisWeekDone: false, days: streak().days.map((d, i) => ({ ...d, state: i < 5 ? 'off' : i === 5 ? 'risk' : 'future' })) });

const ROLES = [
  'surface-dim', 'surface', 'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest', 'surface-bright',
  'on-surface', 'on-surface-variant', 'outline', 'primary', 'primary-container', 'on-primary-container', 'secondary', 'secondary-container', 'tertiary', 'tertiary-container',
  'success', 'success-container', 'warning', 'warning-container', 'error', 'error-container', 'info', 'info-container',
];
const VARIANTS: BtnVariant[] = ['primary', 'tonal', 'secondary', 'tertiary', 'outlined', 'plain', 'glass'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 48 }}>
      <h2 className="t-modal">{title}</h2>
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

const fire = (d: Partial<Delta>) =>
  window.dispatchEvent(
    new CustomEvent('irb:delta', {
      detail: { gained: 0, xp: 1180, level: 5, levelName: 'Brote', levelUp: false, unlock: null, achievements: [], daysPracticed: 14, currentRun: 6, todaySeconds: 600, goalSeconds: 600, goalMetNow: false, reason: null, ...d },
    }),
  );

function EndDemo() {
  const [k, setK] = useState(0);
  return (
    <div style={{ maxWidth: 720 }}>
      <LessonProvider initial={{ ...base, playable: true, title: 'Actitud frente al dinero', next: { slug: 'b', title: 'Nuevos conceptos' } }}>
        <div className="vcard" style={{ borderRadius: 24 }}>
          <EndScreen key={k} soundOn={false} onReplay={() => setK((x) => x + 1)} onAdvance={() => setK((x) => x + 1)} />
        </div>
      </LessonProvider>
    </div>
  );
}

export default function DesignSystem() {
  const toast = useToast();
  const [chip, setChip] = useState('todo');
  return (
    <div className="page-pad" style={{ maxWidth: 1080 }}>
      <p className="t-overline c-variant" style={{ marginTop: 24 }}>
        Rayo · irb-dark
      </p>
      <h1 className="t-display">Sistema visual IRB®</h1>
      <p className="t-body-l c-variant" style={{ marginTop: 8, maxWidth: 680 }}>
        Lenguaje de irbximena.com/v2 sobre la estructura de Sinapsis: noche índigo con el rayo de fondo, Bodoni Moda + Hanken Grotesk, crema para las acciones, oro para el acento y el espectro de los 8 colores del logo para estado y progreso. Componentes reales con datos de ejemplo.
      </p>

      <Section title="Roles de color">
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {ROLES.map((r) => (
            <div key={r} className="card" style={{ overflow: 'hidden', background: 'var(--sin-surface-container-low)' }}>
              <div style={{ height: 48, background: `var(--sin-${r})`, borderBottom: '1px solid var(--sin-outline-variant)' }} />
              <p className="t-label-s" style={{ padding: 8 }}>
                --sin-{r}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Profundidad (hover para elevar)">
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {['--irb-hairline', '--irb-highlight', '--irb-elev-1', '--irb-elev-2', '--irb-glow-primary', '--irb-glow-indigo'].map((t) => (
            <div key={t} className="card interactive pad" style={{ boxShadow: `var(${t})` }}>
              <b className="t-label-l">{t}</b>
            </div>
          ))}
          <div className="card pad glow-border">
            <b className="t-label-l">Borde degradado</b>
            <p className="t-label-s c-variant">máscara 1px</p>
          </div>
          <div className="card pad">
            <b className="t-label-l">
              Ticker: <Ticker value={128} />
            </b>
            <Skeleton h={12} style={{ marginTop: 12 }} />
          </div>
          <div className="thumb" style={{ borderRadius: 12 }}>
            <CoverArt title="Portada generada por hash" />
          </div>
        </div>
      </Section>

      <Section title="Tipografía">
        <div className="stack" style={{ gap: 12 }}>
          <span className="t-display">Display · Bodoni Moda</span>
          <span className="t-page">Título de página 24/32</span>
          <span className="t-modal">Modal 20/28</span>
          <span className="t-card">Tarjeta 16/24</span>
          <span className="t-body-l">Body L 16/24 · Hanken Grotesk</span>
          <span className="t-body-m">Body M 14/24</span>
          <span className="t-label-l">Label L 14/20</span>
          <span className="t-label-m">Label M 12/16</span>
          <span className="t-label-s">Label S 11/16</span>
          <span className="t-overline">Overline 10/12</span>
        </div>
      </Section>

      <Section title="Botones">
        {(['sm', 'md', 'lg'] as const).map((s) => (
          <div key={s} className="row-c" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
            {VARIANTS.map((v) => (
              <button key={v} type="button" className={btn(v, s)}>
                {v === 'primary' && <Icon name="play_arrow" fill />}
                {v}
              </button>
            ))}
          </div>
        ))}
        <button type="button" className={btn('primary')} disabled>
          Deshabilitado
        </button>
      </Section>

      <Section title="Tags, chips y avatares">
        <div className="row-c" style={{ flexWrap: 'wrap' }}>
          <Tag>Curso</Tag>
          <Tag tone="primary">En curso</Tag>
          <Tag tone="secondary">Programa</Tag>
          <Tag tone="tertiary">Práctica</Tag>
          <Tag tone="success" icon="check_circle">
            Completado
          </Tag>
          <Tag tone="warning">Aviso de desarrollo</Tag>
          <Tag tone="error">Error</Tag>
          <Tag tone="info" icon="help">
            Pregunta
          </Tag>
        </div>
        <div className="chips" style={{ marginTop: 16 }}>
          {['todo', 'aportes', 'preguntas', 'sin-responder'].map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={chip === c} onClick={() => setChip(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="row-c" style={{ marginTop: 16, gap: 12 }}>
          {([24, 32, 40, 48, 64] as const).map((s) => (
            <Avatar key={s} name="Ana Demo" size={s} />
          ))}
        </div>
      </Section>

      <Section title="Progreso y esqueletos">
        <div className="stack" style={{ gap: 16, maxWidth: 420 }}>
          <Progress value={0.42} label="Progreso 4px" />
          <Progress value={0.66} kind="goal" label="Progreso de objetivo 6px" />
          <div className="thumb" style={{ height: 80, aspectRatio: 'auto' }}>
            <Progress value={0.3} kind="thumb" />
          </div>
          <Skeleton h={64} />
        </div>
      </Section>

      <Section title="Tarjetas">
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {['', 'outlined', 'elevated', 'raised', 'glass'].map((v) => (
            <div key={v} className={`card interactive pad ${v}`}>
              <b className="t-card">{v || 'filled'}</b>
              <p className="t-body-m c-variant">Overlay 8% / 16%</p>
            </div>
          ))}
          <div className="stacked">
            <div className="card pad">
              <b className="t-card">Programa apilado</b>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Racha semanal">
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          <div className="card pad">
            <p className="t-label-l">Semana practicada</p>
            <WeekRow s={streak()} />
            <StreakCopy s={streak()} />
          </div>
          <div className="card pad">
            <p className="t-label-l">En riesgo (oro)</p>
            <WeekRow s={riskWeek} />
            <StreakCopy s={riskWeek} />
          </div>
        </div>
      </Section>

      <Section title="Hitos (loto)">
        <div className="lotus-grid">
          {(['secondary', 'primary', 'tertiary', 'success', 'info'] as const).map((t) => (
            <div key={t} className="card lotus-card">
              <Lotus tone={t} />
              <span className="t-label-m">{t}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Filas de clase">
        <div className="card" style={{ padding: 8, maxWidth: 420 }}>
          <ClassRow n={1} l={{ id: 1, slug: 'a', title: 'Introducción a la práctica', durationS: 420, isFree: true }} cover={null} p={{ positionS: 420, percent: 100, completed: true }} />
          <ClassRow n={2} l={{ id: 2, slug: 'b', title: 'Respiración y presencia', durationS: 900, isFree: false }} cover={null} p={{ positionS: 300, percent: 33, completed: false }} current />
          <ClassRow n={3} l={{ id: 3, slug: 'c', title: 'Meditación guiada', durationS: 1200, isFree: false, mediaType: 'soundcloud' }} cover={null} locked />
        </div>
      </Section>

      <Section title="Reproductor: video no autorizado (aviso de desarrollo)">
        <div style={{ maxWidth: 720 }}>
          <LessonProvider initial={base}>
            <VideoCard soundOn={false} />
          </LessonProvider>
        </div>
      </Section>

      <Section title="Fin de clase: cuenta regresiva de 8 s">
        <EndDemo />
      </Section>

      <Section title="Estados vacíos y recompensas">
        <div className="card">
          <Empty icon="chat_bubble" title="Sé la primera voz">
            Comparte lo que sentiste en esta práctica.
          </Empty>
        </div>
        <div className="row-c" style={{ flexWrap: 'wrap', marginTop: 16 }}>
          <button type="button" className={btn('tertiary')} onClick={() => toast('Nota guardada')}>
            Toast
          </button>
          <button type="button" className={btn('tertiary')} onClick={() => toast('No se pudo guardar', true)}>
            Toast de error
          </button>
          <button type="button" className={btn('tertiary')} onClick={() => fire({ gained: 15, reason: 'Clase completada' })}>
            XP
          </button>
          <button type="button" className={btn('tertiary')} onClick={() => fire({ levelUp: true, level: 6, levelName: 'Raíz', unlock: 'Meditación de luz' })}>
            Nivel nuevo
          </button>
          <button type="button" className={btn('tertiary')} onClick={() => fire({ achievements: [{ key: 'x', title: 'Primera semana' }] })}>
            Logro
          </button>
        </div>
      </Section>
    </div>
  );
}
