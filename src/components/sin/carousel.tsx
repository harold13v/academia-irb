'use client';

import useEmblaCarousel from 'embla-carousel-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BLUR } from '@/lib/blur';
import { fmt } from '@/lib/fmt';
import type { ContinueItem } from '@/server/home';
import { CoverArt, Icon, Progress } from './ui';

/** "Continúa aprendiendo": carrusel Embla con miniaturas 16:9, progreso de 2px y botones de paso. */
export function ContinueCarousel({ items }: { items: ContinueItem[] }) {
  const [ref, api] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true });
  const [can, setCan] = useState({ prev: false, next: false });
  const update = useCallback(() => api && setCan({ prev: api.canScrollPrev(), next: api.canScrollNext() }), [api]);
  useEffect(() => {
    if (!api) return;
    update();
    api.on('select', update).on('reInit', update).on('scroll', update);
  }, [api, update]);
  return (
    <section aria-label="Continúa aprendiendo">
      <div className="section-h">
        <h2 className="t-modal">Continúa aprendiendo</h2>
        <div className="row-c hide-sm">
          <button type="button" className="btn tertiary icon" aria-label="Anterior" disabled={!can.prev} onClick={() => api?.scrollPrev()}>
            <Icon name="chevron_left" />
          </button>
          <button type="button" className="btn tertiary icon" aria-label="Siguiente" disabled={!can.next} onClick={() => api?.scrollNext()}>
            <Icon name="chevron_right" />
          </button>
        </div>
      </div>
      <div className="embla" ref={ref}>
        <div className="embla-track">
          {items.map((c) => (
            <Link key={c.href} href={c.href} className="embla-slide card interactive" style={{ background: 'none' }}>
              <div className="thumb">
                <CoverArt title={c.course} small />
                {(c.poster ?? c.cover) && <Image src={(c.poster ?? c.cover)!} alt="" fill sizes="(min-width: 1024px) 260px, 72vw" placeholder="blur" blurDataURL={BLUR} />}
                <span className="play-round">
                  <Icon name="play_arrow" fill />
                </span>
                <span className="dur tnum">{fmt(Math.max(0, c.durationS - c.positionS))}</span>
                <Progress value={c.positionS / Math.max(1, c.durationS)} kind="thumb" />
              </div>
              <p className="t-label-l clamp2" style={{ marginTop: 8 }}>
                {c.title}
              </p>
              <p className="t-label-s c-variant clamp1">{c.course}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** "Ver N objetivos más": expande la lista sin navegar. */
export function MoreGoals({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!count) return null;
  return (
    <>
      {open && children}
      <button type="button" className="btn plain" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ justifySelf: 'center' }}>
        {open ? 'Ver menos' : `Ver ${count} ${count === 1 ? 'objetivo' : 'objetivos'} más`}
        <Icon name={open ? 'expand_less' : 'expand_more'} />
      </button>
    </>
  );
}
