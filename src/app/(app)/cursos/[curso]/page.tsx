import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Syllabus } from '@/components/sin/syllabus';
import { Enter } from '@/components/sin/motion';
import { CoverArt, Icon, Progress, Tag, btn } from '@/components/sin/ui';
import { BLUR } from '@/lib/blur';
import { fmt } from '@/lib/fmt';
import { canAccess, getCourseProgress, getOutline } from '@/server/data';
import { currentUser } from '@/server/session';

type P = Promise<{ curso: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const o = await getOutline((await params).curso);
  return { title: o?.title ?? 'Curso' };
}

export default async function CoursePage({ params }: { params: P }) {
  const { curso } = await params;
  const o = await getOutline(curso);
  if (!o) notFound();
  const user = await currentUser();
  const access = await canAccess(user?.id ?? null, o.id, false);
  const prog = user ? await getCourseProgress(user.id, o.id) : {};
  const flat = o.modules.flatMap((m) => m.lessons);
  const done = flat.filter((l) => prog[l.id]?.completed).length;
  const nextIdx = Math.max(0, flat.findIndex((l) => !prog[l.id]?.completed));
  const next = flat[nextIdx] ?? flat[0]!;
  const started = Object.keys(prog).length > 0;
  const openId = o.modules.find((m) => m.lessons.some((l) => l.id === next.id))?.id;
  return (
    <div className="course-immersive">
      {o.cover && (
        <div className="page-glow" aria-hidden="true">
          <Image src={o.cover} alt="" fill sizes="96px" quality={30} />
        </div>
      )}
    <Enter className="page-pad">
      <nav className="crumbs" aria-label="Ruta">
        <Link href="/cursos">Cursos</Link>
        <Icon name="chevron_right" />
        <span style={{ color: 'var(--sin-on-surface)' }} className="clamp1">
          {o.title}
        </span>
      </nav>
      <div className="course-hero">
        <div className="media-glow">
          {o.cover && (
            <span className="glow" aria-hidden="true">
              <Image src={o.cover} alt="" fill sizes="48px" quality={30} />
            </span>
          )}
          <div className="cover-16x9 glow-border" style={{ borderRadius: 'var(--radius-4xl)', boxShadow: 'var(--irb-elev-2)' }}>
            <CoverArt title={o.title} />
            {o.cover && <Image src={o.cover} alt="" fill priority sizes="(min-width: 900px) 560px, 100vw" placeholder="blur" blurDataURL={BLUR} />}
          </div>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          <div className="row-c">
            <Tag tone={o.modules.length >= 3 ? 'secondary' : undefined}>{o.modules.length >= 3 ? 'Programa' : 'Curso'}</Tag>
            {!access && <Tag icon="lock">No está en tu cuenta</Tag>}
          </div>
          <h1 className="t-display">{o.title}</h1>
          {o.subtitle && <p className="t-body-l c-variant">{o.subtitle}</p>}
          <div className="pills tnum">
            <span>
              <Icon name="smart_display" /> {o.count} clases
            </span>
            <span>
              <Icon name="menu_book" /> {o.modules.length} {o.modules.length === 1 ? 'módulo' : 'módulos'}
            </span>
            <span>
              <Icon name="schedule" /> {fmt(o.totalS)}
            </span>
          </div>
          {access && (
            <div className="stack" style={{ gap: 6, marginTop: 4 }}>
              <Progress value={done / Math.max(1, o.count)} label="Avance del curso" />
              <span className="t-label-m c-variant tnum">
                {done} de {o.count} clases completadas
              </span>
            </div>
          )}
          <div className="row-c" style={{ marginTop: 8, gap: 12, flexWrap: 'wrap' }}>
            {access ? (
              <Link className={btn('primary', 'lg')} href={`/cursos/${o.slug}/${next.slug}`}>
                <Icon name="play_arrow" fill />
                {started ? `Continuar clase ${nextIdx + 1}` : 'Empezar el curso'}
              </Link>
            ) : (
              <Link className={btn('primary', 'lg')} href={user ? `/cursos/${o.slug}/${next.slug}` : `/entrar?next=/cursos/${o.slug}`}>
                {user ? 'Ver la primera clase' : 'Entrar'}
              </Link>
            )}
          </div>
        </div>
      </div>
      {o.description && (
        <section style={{ marginTop: 40, maxWidth: 720 }}>
          <h2 className="t-modal">Sobre este curso</h2>
          <div className="prose-irb" style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: o.description }} />
        </section>
      )}
      <section style={{ marginTop: 40 }} aria-labelledby="temario">
        <div className="section-h" style={{ marginTop: 0 }}>
          <h2 id="temario" className="t-modal">
            Temario
          </h2>
          <span className="t-label-m c-variant tnum">
            {o.count} clases · {fmt(o.totalS)}
          </span>
        </div>
        <div className="card pad" style={{ padding: 8 }}>
          <Syllabus modules={o.modules} cover={o.cover} progress={prog} base={`/cursos/${o.slug}`} locked={!access} openId={openId} />
        </div>
      </section>
    </Enter>
    </div>
  );
}
