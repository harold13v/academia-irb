import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { HideStreakRow, Settings, ShareButton } from '@/components/sin/settings';
import { PauseButton, StreakCopy, WeekRow } from '@/components/sin/streak';
import { Ticker } from '@/components/sin/motion';
import { Avatar, CoverArt, Empty, Icon, Lotus, Progress, Tag, btn } from '@/components/sin/ui';
import { BLUR } from '@/lib/blur';
import { signOut } from '@/server/actions';
import { getMyCourses, getProfile, getStats } from '@/server/data';
import { bestRun } from '@/server/home';
import { currentUser } from '@/server/session';
import { getWeeklyStreak, milestones } from '@/server/social';

export const metadata: Metadata = { title: 'Mi perfil' };

export default async function Profile() {
  const user = await currentUser();
  if (!user) redirect('/entrar?next=/perfil');
  const sub = `u:${user.id}`;
  const [stats, p, streak, best, courses] = await Promise.all([getStats(sub, user.dailyGoalMin, user.timezone), getProfile(sub), getWeeklyStreak(sub, user.timezone, user.hideStreak), bestRun(sub), getMyCourses(user.id)]);
  const ms = milestones(streak.totalDays, best);
  const earned = p.achievements.filter((a) => a.earnedAt);
  const lvl = stats.nextThreshold !== null ? Math.min(1, (stats.xp - stats.levelFloor) / Math.max(1, stats.nextThreshold - stats.levelFloor)) : 1;
  const certs = courses.filter((c) => c.total > 0 && c.done >= c.total);
  return (
    <div className="page-pad" style={{ maxWidth: 960 }}>
      <div className="profile-head">
        <span className="level-ring" title={`Etapa ${stats.level}`}>
          <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
            <defs>
              <linearGradient id="lvl" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f5b73b" />
                <stop offset="1" stopColor="#9ea3ff" />
              </linearGradient>
            </defs>
            <circle cx="40" cy="40" r="37" fill="none" stroke="var(--sin-surface-container-highest)" strokeWidth="4" />
            <circle cx="40" cy="40" r="37" fill="none" stroke="url(#lvl)" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 37} strokeDashoffset={2 * Math.PI * 37 * (1 - lvl)} />
          </svg>
          <Avatar name={user.name} size={64} />
        </span>
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <h1 className="t-page clamp1">{user.name}</h1>
          <span className="row-c">
            <Tag tone="secondary" icon="spa">
              {stats.levelName}
            </Tag>
            <span className="t-label-m c-variant">Etapa {stats.level} de tu camino</span>
          </span>
        </div>
      </div>

      <div className="stat-grid">
        {[
          { v: streak.totalDays, l: 'días de práctica', i: 'calendar_month', t: 'var(--sin-primary)' },
          { v: streak.hidden ? null : streak.weeks, l: streak.hidden ? 'racha oculta' : streak.weeks === 1 ? 'semana seguida' : 'semanas seguidas', i: 'local_fire_department', t: 'var(--sin-secondary)' },
          { v: best, l: 'días seguidos, tu mejor marca', i: 'emoji_events', t: 'var(--sin-tertiary)' },
          { v: earned.length, l: 'logros', i: 'workspace_premium', t: 'var(--sin-success)' },
        ].map((x) => (
          <div key={x.i} className="card stat" style={{ ['--tint' as string]: x.t }}>
            <span className="stat-ico">
              <Icon name={x.i} fill />
            </span>
            <b>{x.v === null ? '—' : <Ticker value={x.v} />}</b>
            <span className="t-label-m c-variant">{x.l}</span>
          </div>
        ))}
      </div>

      <section id="progreso" style={{ scrollMarginTop: 80 }}>
        <div className="section-h">
          <h2 className="t-modal">Tu semana</h2>
          <PauseButton s={streak} />
        </div>
        <div className="card pad">
          <WeekRow s={streak} />
          <StreakCopy s={streak} />
          <HideStreakRow initial={user.hideStreak} />
        </div>
        {courses.length > 0 && (
          <div className="card pad" style={{ marginTop: 16 }}>
            <p className="t-overline c-variant" style={{ marginBottom: 8 }}>
              Tus cursos
            </p>
            {courses.map((c) => (
              <Link key={c.slug} href={`/cursos/${c.slug}`} className="pref-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px auto', gap: 16 }}>
                <span className="t-label-l clamp1">{c.title}</span>
                <Progress value={c.done / Math.max(1, c.total)} />
                <span className="t-label-m c-variant tnum">
                  {c.done}/{c.total}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="hitos">
        <div className="section-h">
          <h2 id="hitos" className="t-modal">
            Hitos
          </h2>
          <span className="t-label-m c-variant">7 seguidos o 50 en total</span>
        </div>
        <div className="lotus-grid">
          {ms.map((m) => (
            <div key={m.key} className="card lotus-card" data-done={m.done}>
              <Lotus tone={m.tone} />
              <b className="t-label-l">{m.label}</b>
              <span className="t-label-s c-variant">{m.done ? 'Alcanzado' : 'Por florecer'}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="camino">
        <div className="section-h">
          <h2 id="camino" className="t-modal">
            Etapas del camino
          </h2>
        </div>
        <div className="card" style={{ padding: 8 }}>
          <ol className="path">
            {p.levels.map((l) => (
              <li key={l.level} data-done={l.level < stats.level} data-cur={l.level === stats.level}>
                <span className="stp tnum">{l.level < stats.level ? <Icon name="check" size={16} /> : l.level}</span>
                <span className="stack" style={{ minWidth: 0 }}>
                  <b className="t-label-l">{l.name}</b>
                  {l.unlockLabel && <span className="t-label-s c-variant">Abre: {l.unlockLabel}</span>}
                </span>
                {l.level === stats.level && <Tag tone="primary">Estás aquí</Tag>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="logros" style={{ scrollMarginTop: 80 }}>
        <div className="section-h">
          <h2 className="t-modal">Logros</h2>
          <span className="t-label-m c-variant tnum">
            {earned.length} de {p.achievements.length}
          </span>
        </div>
        <div className="lotus-grid">
          {p.achievements.map((a) => (
            <div key={a.key} className={`card medal${a.earnedAt ? ' glow-border' : ''}`} data-locked={!a.earnedAt}>
              <span className="disc">
                <Icon name={a.earnedAt ? 'emoji_events' : 'lock'} fill size={26} />
              </span>
              <b className="t-label-l">{a.title}</b>
              <span className="t-label-s c-variant">{a.earnedAt ? new Date(a.earnedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : a.description}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="certificados" style={{ scrollMarginTop: 80 }}>
        <div className="section-h">
          <h2 className="t-modal">Certificados</h2>
        </div>
        {certs.length ? (
          <div className="goals">
            {certs.map((c) => (
              <div key={c.slug} className="card goal-card">
                <span className="cover-16x9"><CoverArt title={c.title} small />{c.cover && <Image src={c.cover} alt="" fill sizes="176px" placeholder="blur" blurDataURL={BLUR} />}</span>
                <span className="stack" style={{ gap: 4 }}>
                  <Tag tone="success" icon="verified">
                    Completado
                  </Tag>
                  <b className="t-card">{c.title}</b>
                  <span className="t-label-m c-variant">{c.total} clases</span>
                </span>
                <ShareButton title={c.title} url={`/cursos/${c.slug}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <Empty icon="workspace_premium" title="Tu primer certificado te espera">
              Al completar todas las clases de un curso, aparece aquí para compartirlo.
            </Empty>
          </div>
        )}
      </section>

      <section id="ajustes" style={{ scrollMarginTop: 80 }}>
        <div className="section-h">
          <h2 className="t-modal">Ajustes</h2>
        </div>
        <Settings reminderHour={user.reminderHour ?? null} sound={user.soundOn} goal={user.dailyGoalMin} circles={user.circlesOptIn} />
        <form action={signOut} style={{ marginTop: 24 }}>
          <button className={btn('plain')} type="submit">
            <Icon name="arrow_back" /> Salir de la cuenta
          </button>
        </form>
      </section>
    </div>
  );
}
