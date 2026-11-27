import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ContinueCarousel, MoreGoals } from '@/components/sin/carousel';
import { Enter } from '@/components/sin/motion';
import { Corners } from '@/components/rayo/corners';
import { Eyebrow, Title } from '@/components/rayo/title';
import { Avatar, CoverArt, Icon, Progress, Tag, btn } from '@/components/sin/ui';
import { BLUR } from '@/lib/blur';
import { fmt, minutes } from '@/lib/fmt';
import { getMyCourses, getOutline, type MyCourse } from '@/server/data';
import { getContinue, moduleCounts } from '@/server/home';
import { currentUser } from '@/server/session';
import { circleToday } from '@/server/social';

export const metadata: Metadata = { title: 'Inicio' };

/** Saludo según la hora local de la alumna (su zona horaria; Bogotá por defecto). */
function greeting(tz = 'America/Bogota') {
  const h = Number(new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()));
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function Hero({ over, title, sub, href, cta, cover, value, meta, priority = true }: { over: string; title: string; sub: string; href: string; cta: string; cover: string | null; value?: number; meta: string; priority?: boolean }) {
  return (
    <section className="hx" aria-labelledby="next-step">
      {cover && (
        <div className="hx-ambient" aria-hidden="true">
          <Image src={cover} alt="" fill sizes="96px" quality={30} />
        </div>
      )}
      <div className="hx-copy">
        <p className="hx-over">{over}</p>
        <Title as="h2" id="next-step" className="hero-title" text={title} auto />
        <p className="hx-sub">{sub}</p>
        {value !== undefined && (
          <div className="hx-progress">
            <Progress value={value} label="Avance del curso" kind="goal" />
            <span className="tnum">{Math.round(value * 100)}%</span>
          </div>
        )}
        <div className="hx-actions">
          <Link className={btn('primary', 'lg')} href={href}>
            <Icon name="play_arrow" fill /> {cta}
          </Link>
          <span className="hx-meta tnum">
            <Icon name="schedule" size={16} /> {meta}
          </span>
        </div>
      </div>
      <Link href={href} className="hx-art" tabIndex={-1} aria-hidden="true" data-cursor="Play">
        <CoverArt title={sub} />
        <Corners />
        {cover && <Image src={cover} alt="" fill priority={priority} sizes="(min-width: 1024px) 560px, 100vw" placeholder="blur" blurDataURL={BLUR} />}
        <span className="hx-play">
          <Icon name="play_arrow" fill size={28} />
        </span>
      </Link>
    </section>
  );
}

function GoalCard({ c, modules, active }: { c: MyCourse; modules: number; active?: boolean }) {
  const program = modules >= 3;
  const pct = c.done / Math.max(1, c.total);
  const href = c.lastLessonSlug && c.done < c.total ? `/cursos/${c.slug}/${c.lastLessonSlug}` : `/cursos/${c.slug}`;
  return (
    <div>
      <Link href={href} className={`card interactive goal-card${active ? ' glow-border' : ''}`}>
        <span className="cover-16x9"><CoverArt title={c.title} small />{c.cover && <Image src={c.cover} alt="" fill sizes="(min-width: 768px) 176px, 96px" placeholder="blur" blurDataURL={BLUR} />}</span>
        <span className="stack" style={{ gap: 6, minWidth: 0 }}>
          <span className="row-c" style={{ flexWrap: 'wrap', gap: 6 }}>
            <Tag tone={program ? 'secondary' : undefined}>{program ? `Programa · ${modules} módulos` : 'Curso'}</Tag>
            {c.done >= c.total ? <Tag tone="success" icon="check_circle">Completado</Tag> : c.done > 0 || c.lastLessonSlug ? <Tag tone="primary">En curso</Tag> : <Tag>Sin empezar</Tag>}
          </span>
          <b className="t-card clamp2">{c.title}</b>
          <Progress value={pct} kind="goal" />
          <span className="t-label-m c-variant tnum">
            {c.done} de {c.total} clases
          </span>
        </span>
        <span className={btn('tertiary', 'md', 'goal-cta')}>{c.done >= c.total ? 'Repasar' : c.done || c.lastLessonSlug ? 'Continuar' : 'Empezar'}</span>
      </Link>
    </div>
  );
}

export default async function Home() {
  const user = await currentUser();
  const fuegos = await getOutline('fuegos');
  if (!user)
    return (
      <div className="page-pad">
        <Eyebrow>Academia IRB®</Eyebrow>
        <Title className="t-display" text="Tu práctica" em="con IRB®." style={{ marginTop: 14 }} />
        <p className="t-body-l c-variant" style={{ marginTop: 8, marginBottom: 24 }}>
          Entra para ver tus cursos y retomar donde quedaste.
        </p>
        {fuegos && (
          <Hero over="Práctica gratuita" title={fuegos.title} sub={fuegos.subtitle} href="/practicas/fuegos" cta="Empezar práctica" cover={fuegos.cover} meta={minutes(fuegos.totalS)} />
        )}
        <div className="row-c" style={{ marginTop: 24 }}>
          <Link className={btn('outlined', 'lg')} href="/entrar">
            Entrar a mi cuenta
          </Link>
        </div>
      </div>
    );

  const [courses, cont, mods, circle] = await Promise.all([getMyCourses(user.id), getContinue(user.id), moduleCounts(), circleToday(user.id, user.timezone)]);
  const resume = courses.find((c) => c.lastLessonSlug && c.done < c.total);
  const first = !resume ? courses.find((c) => c.done < c.total) : undefined;
  const firstOutline = first ? await getOutline(first.slug) : null;
  const goals = [...courses].sort((a, b) => Number(b.done < b.total) - Number(a.done < a.total));
  const name = user.name.split(' ')[0];
  return (
    <Enter className="page-pad">
      <div className="row-c" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, margin: '8px 0 24px' }}>
        <div className="stack" style={{ gap: 10 }}>
          <Eyebrow>{greeting(user.timezone ?? undefined)}</Eyebrow>
          <Title className="t-page" text="Hola," em={`${name}.`} />
        </div>
        {circle && circle.practicedToday.length > 0 && (
          <Link href="/circulos" className="presence">
            <span className="avatars">
              {circle.practicedToday.slice(0, 3).map((n) => (
                <Avatar key={n} name={n} size={24} />
              ))}
            </span>
            {circle.practicedToday.length} de tu círculo {circle.practicedToday.length === 1 ? 'practicó' : 'practicaron'} hoy
          </Link>
        )}
      </div>

      {resume ? (
        <Hero
          over="Siguiente paso"
          title={resume.lastLessonTitle!}
          sub={resume.title}
          href={`/cursos/${resume.slug}/${resume.lastLessonSlug}`}
          cta="Continuar"
          cover={resume.cover}
          value={resume.done / Math.max(1, resume.total)}
          meta={resume.lastPosition ? `Retomas en ${fmt(resume.lastPosition)} de ${fmt(resume.lastDuration)}` : `${fmt(resume.lastDuration)} de clase`}
        />
      ) : first && firstOutline ? (
        <Hero over="Siguiente paso" title={firstOutline.modules[0]?.lessons[0]?.title ?? first.title} sub={first.title} href={`/cursos/${first.slug}`} cta="Empezar" cover={first.cover} value={0} meta={`${first.total} clases`} />
      ) : fuegos ? (
        <Hero over="Siguiente paso" title={fuegos.title} sub={fuegos.subtitle} href="/practicas/fuegos" cta="Practicar" cover={fuegos.cover} meta={minutes(fuegos.totalS)} />
      ) : null}

      {goals.length > 0 && (
        <section aria-labelledby="goals" className="reveal">
          <div className="section-h">
            <Title as="h2" id="goals" className="t-modal" text="Tus" em="objetivos" />
            <Link href="/cursos" className={btn('plain', 'sm')}>
              Ver todos <Icon name="chevron_right" />
            </Link>
          </div>
          <div className="goals">
            {goals.slice(0, 3).map((c, i) => (
              <GoalCard key={c.slug} c={c} modules={mods[c.slug] ?? 1} active={i === 0 && c.done < c.total} />
            ))}
            <MoreGoals count={Math.max(0, goals.length - 3)}>
              {goals.slice(3).map((c) => (
                <GoalCard key={c.slug} c={c} modules={mods[c.slug] ?? 1} />
              ))}
            </MoreGoals>
          </div>
        </section>
      )}

      {cont.length > 0 && <ContinueCarousel items={cont} />}

      {fuegos && (
        <section aria-labelledby="free" className="reveal">
          <div className="section-h">
            <Title as="h2" id="free" className="t-modal" text="Práctica" em="gratuita" />
          </div>
          <Link href="/practicas/fuegos" className="card interactive goal-card">
            <span className="cover-16x9"><CoverArt title={fuegos.title} small />{fuegos.cover && <Image src={fuegos.cover} alt="" fill sizes="(min-width: 768px) 176px, 96px" placeholder="blur" blurDataURL={BLUR} />}</span>
            <span className="stack" style={{ gap: 6 }}>
              <Tag tone="tertiary" icon="self_improvement">
                Práctica guiada
              </Tag>
              <b className="t-card">{fuegos.title}</b>
              <span className="t-label-m c-variant">{fuegos.subtitle}</span>
            </span>
            <span className={btn('tertiary', 'md', 'goal-cta')}>Practicar</span>
          </Link>
        </section>
      )}
    </Enter>
  );
}
