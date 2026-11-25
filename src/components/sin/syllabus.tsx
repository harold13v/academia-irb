'use client';

import * as Collapsible from '@radix-ui/react-collapsible';
import Image from 'next/image';
import Link from 'next/link';
import { BLUR } from '@/lib/blur';
import { fmt, mediaLabel } from '@/lib/fmt';
import { CoverArt, Icon, Progress } from './ui';

export type SylLesson = { id: number; slug: string; title: string; durationS: number; mediaType?: string; isFree: boolean };
export type SylModule = { id: number; title: string; lessons: SylLesson[] };
type Prog = Record<number, { positionS: number; percent: number; completed: boolean }>;

/** Fila de clase: número, miniatura 16:9 con progreso de 2px, título y estado. */
export function ClassRow({ n, l, cover, p, current, locked, href, onClick }: { n: number; l: SylLesson; cover: string | null; p?: Prog[number]; current?: boolean; locked?: boolean; href?: string; onClick?: (e: React.MouseEvent) => void }) {
  const inner = (
    <>
      <span className="num tnum">{p?.completed ? <Icon name="check_circle" fill className="c-success" /> : locked ? <Icon name="lock" /> : n}</span>
      <span className="mini">
        <CoverArt title={l.title} small />
        {cover && <Image src={cover} alt="" fill sizes="80px" placeholder="blur" blurDataURL={BLUR} />}
        {(p?.positionS ?? 0) > 0 && !p?.completed && <Progress value={p!.positionS / Math.max(1, l.durationS)} kind="thumb" />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="ttl clamp2">{l.title}</span>
        <span className="sub tnum">
          {current ? <span className="now">Viendo ahora</span> : p?.completed ? <span className="ok">Completada</span> : (p?.positionS ?? 0) > 0 ? <span>En curso</span> : null}
          <span>{fmt(l.durationS)}</span>
          {l.mediaType && l.mediaType !== 'vimeo' && <span>· {mediaLabel[l.mediaType]}</span>}
        </span>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="cls-row" aria-current={current ? 'true' : undefined} onClick={onClick} scroll={false}>
      {inner}
    </Link>
  ) : (
    <button type="button" className="cls-row" aria-current={current ? 'true' : undefined} onClick={onClick}>
      {inner}
    </button>
  );
}

/** Temario por módulos plegables (Radix Collapsible). */
export function Syllabus({ modules, cover, progress, base, currentId, locked, openId, renderRow }: { modules: SylModule[]; cover: string | null; progress: Prog; base: string; currentId?: number; locked?: boolean; openId?: number; renderRow?: (n: number, l: SylLesson) => React.ReactNode }) {
  let n = 0;
  return (
    <div className="stack" style={{ gap: 4 }}>
      {modules.map((m, mi) => {
        const rows = m.lessons.map((l) => {
          n++;
          return renderRow ? <div key={l.id}>{renderRow(n, l)}</div> : <ClassRow key={l.id} n={n} l={l} cover={cover} p={progress[l.id]} current={l.id === currentId} locked={locked && !l.isFree} href={`${base}/${l.slug}`} />;
        });
        if (modules.length === 1) return <div key={m.id}>{rows}</div>;
        const done = m.lessons.filter((l) => progress[l.id]?.completed).length;
        return (
          <Collapsible.Root key={m.id} defaultOpen={openId ? m.id === openId : mi === 0}>
            <Collapsible.Trigger className="mod-head">
              <span className="stack" style={{ minWidth: 0 }}>
                <b className="t-label-l">{m.title}</b>
                <span className="t-label-s c-variant tnum">
                  {done}/{m.lessons.length} clases · {fmt(m.lessons.reduce((a, l) => a + l.durationS, 0))}
                </span>
              </span>
              <Icon name="expand_more" />
            </Collapsible.Trigger>
            <Collapsible.Content>{rows}</Collapsible.Content>
          </Collapsible.Root>
        );
      })}
    </div>
  );
}
