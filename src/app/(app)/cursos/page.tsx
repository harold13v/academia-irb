import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
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
      <h1 className="t-page" style={{ margin: '8px 0 24px' }}>
        Cursos y prácticas
      </h1>
      <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {all.map((c, i) => (
          <Link key={c.slug} href={c.kind === 'practice' ? `/practicas/${c.slug}` : `/cursos/${c.slug}`} className="card interactive" style={{ background: 'none' }}>
            <div className={c.modules >= 3 ? 'stacked' : undefined} style={{ marginTop: c.modules >= 3 ? 12 : 0 }}>
              <div className="thumb">
                <CoverArt title={c.title} />
                {c.cover && <Image src={c.cover} alt="" fill priority={i < 2} sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 100vw" placeholder="blur" blurDataURL={BLUR} />}
                {c.enrolled && c.done > 0 && <Progress value={c.done / Math.max(1, c.total)} kind="thumb" />}
              </div>
            </div>
            <div className="row-c" style={{ marginTop: 12, gap: 6, flexWrap: 'wrap' }}>
              {c.kind === 'practice' ? <Tag tone="tertiary">Práctica gratuita</Tag> : <Tag tone={c.modules >= 3 ? 'secondary' : undefined}>{c.modules >= 3 ? 'Programa' : 'Curso'}</Tag>}
              {c.kind !== 'practice' && !c.enrolled && <Tag icon="lock">No está en tu cuenta</Tag>}
              {c.enrolled && c.done >= c.total && <Tag tone="success">Completado</Tag>}
            </div>
            <p className="t-card clamp2" style={{ marginTop: 8 }}>
              {c.title}
            </p>
            <p className="meta-row tnum" style={{ marginTop: 4 }}>
              <span>
                <Icon name="smart_display" /> {c.total} {c.total === 1 ? 'clase' : 'clases'}
              </span>
              <span>
                <Icon name="schedule" /> {fmt(c.totalS)}
              </span>
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
