'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/** Entrada orquestada: header → hero → secciones (stagger 60 ms, y 12→0, .5s expo) en CSS: corre desde el primer pintado,
 *  sin esperar la hidratación (no retrasa el LCP). Solo en la primera carga de la sesión (html[data-entered] lo apaga). */
export function Enter({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`enter ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Número que cuenta hasta su valor en .9s al entrar en pantalla (tabular-nums). */
export function Ticker({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(value);
  useEffect(() => {
    if (!seen || reduce || value <= 0) return setN(value);
    const c = animate(0, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => setN(Math.round(x)) });
    return () => c.stop();
  }, [seen, value, reduce]);
  return (
    <span ref={ref} className={`tnum ${className ?? ''}`}>
      {n}
    </span>
  );
}
