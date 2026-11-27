import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Eyebrow, Title } from '@/components/rayo/title';
import { CoverArt, Icon, Progress, Tag } from '@/components/sin/ui';
import { BLUR } from '@/lib/blur';
import { fmt } from '@/lib/fmt';
import { getCatalog } from '@/server/home';
import { currentUser } from '@/server/session';

export const metadata: Metadata = { title: 'Cursos' };

export default async function Courses() {
  const user = await currentUser();
  const all = await getCatalog(user?.id ?? null);
  return (
    <div className="page-pad">
      <div className="stack" style={{ gap: 14, margin: '8px 0 40px' }}>
        <Eyebrow>Tu biblioteca</Eyebrow>
        <Title className="t-display" text="Cursos y" em="prácticas." />
        <p className="t-body-l c-variant" style={{ maxWidth: 560 }}>
          Talleres, programas y prácticas guiadas de IRB®. Cada uno con su propio arte: el símbolo de lo que transforma.
        </p>
      </div>
      <div className="cat-grid">
        {all.map((c, i) => {
          const href = c.kind === 'practice' ? `/practicas/${c.slug}` : `/cursos/${c.slug}`;
          const cta = c.kind === 'practice' ? 'Practicar' : !c.enrolled ? 'Ver curso' : c.done >= c.total ? 'Repasar' : c.done > 0 ? 'Continuar' : 'Empezar';
          return (
            <Link key={c.slug} href={href} className="cat-card reveal">
              <div className="thumb" data-cursor="Ver">
                <CoverArt title={c.title} n={i + 1} />
                {c.cover && <Image src={c.cover} alt="" fill priority={i < 2} sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 100vw" placeholder="blur" blurDataURL={BLUR} />}
                {c.enrolled && c.done > 0 && <Progress value={c.done / Math.max(1, c.total)} kind="thumb" />}
              </div>
              <div className="cat-body">
                <div className="row-c" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {c.kind === 'practice' ? <Tag tone="tertiary">Práctica gratuita</Tag> : <Tag tone={c.modules >= 3 ? 'secondary' : undefined}>{c.modules >= 3 ? 'Programa' : 'Curso'}</Tag>}
                  {c.kind !== 'practice' && !c.enrolled && <Tag icon="lock">No está en tu cuenta</Tag>}
                  {c.enrolled && c.done >= c.total && <Tag tone="success">Completado</Tag>}
                </div>
                <p className="cat-title clamp2">{c.title}</p>
                <div className="cat-foot tnum">
                  <span className="row-c" style={{ gap: 14 }}>
                    <span className="row-c" style={{ gap: 4 }}>
                      <Icon name="smart_display" /> {c.total} {c.total === 1 ? 'clase' : 'clases'}
                    </span>
                    <span className="row-c" style={{ gap: 4 }}>
                      <Icon name="schedule" /> {fmt(c.totalS)}
                    </span>
                  </span>
                  <span className="cat-go">
                    {cta} <span aria-hidden="true">→</span>
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
