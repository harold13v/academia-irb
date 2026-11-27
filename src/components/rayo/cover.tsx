'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * Portadas generativas de irbximena.com/v2 (prototipo/js/covers.js): cada curso tiene su propio arte, único y estable
 * (semilla = título), con el símbolo de lo que transforma:
 *   miedo → círculo que se agrieta y deja salir la luz · riqueza → flor de la vida dorada · amor → vesica piscis
 *   conciencia → el ojo y la pineal · salud/respiración → flor que se abre · meditar → ondas y gota de luz
 *   propósito → espiral áurea · fuego → brasas que ascienden.
 * Se dibuja una sola vez cuando entra en pantalla (no consume nada al hacer scroll). La imagen real, si existe, va encima.
 */

type Intent = 'miedo' | 'riqueza' | 'amor' | 'conciencia' | 'salud' | 'meditar' | 'proposito' | 'fuego';
const ICOL: Record<Intent, string> = { miedo: '#7A6CF0', riqueza: '#FFD141', amor: '#F196CE', conciencia: '#A35BD9', salud: '#8BD336', meditar: '#3D8BFF', proposito: '#E2574E', fuego: '#FF4A3D' };
const SPEC = ['#7A6CF0', '#E2574E', '#FF4A3D', '#FFD141', '#8BD336', '#3D8BFF', '#A35BD9', '#F196CE'];
const ORDER: Intent[] = ['miedo', 'riqueza', 'amor', 'conciencia', 'salud', 'meditar', 'proposito'];
const WORDS: [Intent, RegExp][] = [
  ['fuego', /fuego|brasa|hoguera|purific/],
  ['miedo', /miedo|sombra|soltar|liber|ansiedad/],
  ['riqueza', /riqueza|abundan|dinero|prosper|financ/],
  ['amor', /amor|relaci|pareja|coraz|perd[oó]n|familia/],
  ['salud', /salud|cuerpo|respir|pausa|sana|bienestar|activa/],
  ['meditar', /medita|calma|silencio|mantra|sonido/],
  ['conciencia', /concien|luz|pineal|adn|despert|ilumin|esp[ií]ritu/],
  ['proposito', /prop[oó]sito|sue[ñn]o|crea|camino|empresa|tiempo|meta|cierre|diario|integra|trabajo/],
];

const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
export const intentOf = (title: string): Intent => {
  const t = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return WORDS.find(([, re]) => re.test(t))?.[0] ?? ORDER[hash(title) % ORDER.length]!;
};

type Ctx = CanvasRenderingContext2D;
type Motif = (c: Ctx, x: number, y: number, R: number, r: () => number, col: string) => void;
const TAU = Math.PI * 2;
const orb = (c: Ctx, x: number, y: number, R: number, col: string, a = 0.7) => {
  const g = c.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, 'rgba(255,255,255,.95)');
  g.addColorStop(0.18, rgba(col, a));
  g.addColorStop(1, rgba(col, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, R, 0, TAU);
  c.fill();
};

const MOTIF: Record<Intent, Motif> = {
  miedo(c, x, y, R, r, col) {
    orb(c, x, y, R, col);
    c.strokeStyle = 'rgba(255,255,255,.85)';
    c.lineWidth = 1.2;
    for (let i = 0; i < 7; i++) {
      let a = r() * TAU,
        px = x,
        py = y;
      c.beginPath();
      c.moveTo(px, py);
      for (let k = 0; k < 5; k++) {
        a += (r() - 0.5) * 0.9;
        const l = R * (0.12 + r() * 0.16);
        px += Math.cos(a) * l;
        py += Math.sin(a) * l;
        c.lineTo(px, py);
      }
      c.stroke();
    }
    c.strokeStyle = rgba(col, 0.6);
    c.lineWidth = 2;
    c.setLineDash([R * 0.35, R * 0.12]);
    c.beginPath();
    c.arc(x, y, R * 0.82, r() * 6, r() * 6 + 5.6);
    c.stroke();
    c.setLineDash([]);
  },
  riqueza(c, x, y, R, _r, col) {
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      c.strokeStyle = rgba(col, 0.12 + Number(i % 4 === 0) * 0.25);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5);
      c.lineTo(x + Math.cos(a) * R * 1.25, y + Math.sin(a) * R * 1.25);
      c.stroke();
    }
    const rr = R * 0.3;
    c.strokeStyle = rgba(col, 0.9);
    c.lineWidth = 1.3;
    const pts: [number, number][] = [[0, 0]];
    for (let i = 0; i < 6; i++) pts.push([Math.cos(i * 1.0472) * rr, Math.sin(i * 1.0472) * rr]);
    for (let i = 0; i < 6; i++) pts.push([Math.cos(i * 1.0472 + 0.5236) * rr * 1.732, Math.sin(i * 1.0472 + 0.5236) * rr * 1.732]);
    for (const [dx, dy] of pts) {
      c.beginPath();
      c.arc(x + dx, y + dy, rr, 0, TAU);
      c.stroke();
    }
    c.strokeStyle = rgba(col, 0.5);
    c.beginPath();
    c.arc(x, y, rr * 2.05, 0, TAU);
    c.stroke();
    orb(c, x, y, rr, col, 0.5);
  },
  amor(c, x, y, R, r, col) {
    const d = R * (0.28 + r() * 0.06);
    for (const s of [-1, 1]) {
      const g = c.createRadialGradient(x + s * d, y, 0, x + s * d, y, R * 0.62);
      g.addColorStop(0, rgba(col, 0.25));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(x + s * d, y, R * 0.62, 0, TAU);
      c.fill();
      c.strokeStyle = rgba(s < 0 ? col : '#ffffff', 0.8);
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(x + s * d, y, R * 0.62, 0, TAU);
      c.stroke();
    }
    const hs = R * 0.2;
    c.fillStyle = 'rgba(255,255,255,.95)';
    c.beginPath();
    c.moveTo(x, y + hs * 0.9);
    c.bezierCurveTo(x - hs * 1.6, y - hs * 0.2, x - hs * 0.6, y - hs * 1.3, x, y - hs * 0.45);
    c.bezierCurveTo(x + hs * 0.6, y - hs * 1.3, x + hs * 1.6, y - hs * 0.2, x, y + hs * 0.9);
    c.fill();
  },
  conciencia(c, x, y, R, _r, col) {
    const w = R * 1.05,
      h = R * 0.55;
    c.strokeStyle = 'rgba(255,255,255,.85)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(x - w, y);
    c.quadraticCurveTo(x, y - h * 1.6, x + w, y);
    c.quadraticCurveTo(x, y + h * 1.6, x - w, y);
    c.stroke();
    for (let i = 0; i < 9; i++) {
      c.strokeStyle = rgba(i % 2 ? col : '#ffffff', 0.25 + i * 0.06);
      c.beginPath();
      c.arc(x, y, h * (0.15 + i * 0.1), 0, TAU);
      c.stroke();
    }
    orb(c, x, y, h * 0.5, col, 0.4);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      c.strokeStyle = rgba(col, 0.25);
      c.beginPath();
      c.moveTo(x + Math.cos(a) * w * 1.08, y + Math.sin(a) * w * 1.08);
      c.lineTo(x + Math.cos(a) * w * 1.2, y + Math.sin(a) * w * 1.2);
      c.stroke();
    }
  },
  salud(c, x, y, R, r, col) {
    const n = 8 + Math.floor(r() * 5),
      rot = r() * 6;
    for (let k = 0; k < 2; k++)
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * TAU + (k * Math.PI) / n,
          L = R * (k ? 0.62 : 0.9);
        c.save();
        c.translate(x, y);
        c.rotate(a);
        const g = c.createLinearGradient(0, 0, L, 0);
        g.addColorStop(0, 'rgba(255,255,255,.9)');
        g.addColorStop(1, rgba(col, k ? 0.5 : 0.25));
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(L * 0.5, -L * 0.22, L, 0);
        c.quadraticCurveTo(L * 0.5, L * 0.22, 0, 0);
        c.fill();
        c.restore();
      }
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(x, y, R * 0.06, 0, TAU);
    c.fill();
  },
  meditar(c, x, y, R, _r, col) {
    for (let i = 0; i < 9; i++) {
      c.strokeStyle = rgba(i % 3 ? col : '#ffffff', 0.75 - i * 0.07);
      c.lineWidth = 1.3;
      c.beginPath();
      c.ellipse(x, y + R * 0.35, R * (0.15 + i * 0.13), R * (0.05 + i * 0.042), 0, 0, TAU);
      c.stroke();
    }
    orb(c, x, y - R * 0.25, R * 0.3, col);
  },
  proposito(c, x, y, R, r, col) {
    c.strokeStyle = 'rgba(255,255,255,.9)';
    c.lineWidth = 1.6;
    c.beginPath();
    const rot = r() * 6;
    for (let t = 0; t <= 1; t += 0.004) {
      const a = rot + t * 3.2 * TAU,
        rr = R * 0.04 * Math.exp(t * 3.2);
      const px = x + Math.cos(a) * rr,
        py = y + Math.sin(a) * rr;
      if (t) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.stroke();
    for (let i = 1; i < 6; i++) {
      c.strokeStyle = rgba(col, 0.2 + i * 0.08);
      c.lineWidth = 1;
      c.beginPath();
      c.arc(x, y, R * 0.04 * Math.exp(i * 0.64), 0, TAU);
      c.stroke();
    }
    orb(c, x, y, R * 0.18, col, 0.5);
  },
  fuego(c, x, y, R, r, col) {
    // tres llamas de luz y brasas que suben
    for (const [dx, s] of [
      [0, 1],
      [-0.42, 0.62],
      [0.42, 0.7],
    ] as const) {
      const fx = x + dx * R,
        fy = y + R * 0.55,
        H = R * 1.25 * s,
        W = R * 0.36 * s;
      const g = c.createLinearGradient(fx, fy, fx, fy - H);
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(0.25, rgba('#FFD141', 0.85));
      g.addColorStop(0.7, rgba(col, 0.55));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(fx, fy);
      c.bezierCurveTo(fx - W * 1.3, fy - H * 0.35, fx - W * 0.2, fy - H * 0.6, fx, fy - H);
      c.bezierCurveTo(fx + W * 0.25, fy - H * 0.6, fx + W * 1.3, fy - H * 0.35, fx, fy);
      c.fill();
    }
    for (let i = 0; i < 40; i++) {
      c.fillStyle = rgba(i % 3 ? '#FFD141' : col, 0.3 + r() * 0.6);
      c.beginPath();
      c.arc(x + (r() - 0.5) * R * 2.2, y + R * 0.5 - r() * R * 2, 0.6 + r() * 1.6, 0, TAU);
      c.fill();
    }
    c.strokeStyle = rgba(col, 0.55);
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(x, y + R * 0.6, R * 1.1, R * 0.14, 0, 0, TAU);
    c.stroke();
  },
};

function draw(cv: HTMLCanvasElement, title: string, small: boolean) {
  const w = cv.clientWidth || 300,
    h = cv.clientHeight || 170,
    dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const c = cv.getContext('2d');
  if (!c) return;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = rng(hash(title)),
    intent = intentOf(title),
    col = ICOL[intent];
  // noche índigo con la luz de la intención
  const g = c.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, '#15104a');
  g.addColorStop(1, '#06051c');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const gx = w * (0.25 + r() * 0.5),
    gy = h * (0.25 + r() * 0.3);
  const glow = c.createRadialGradient(gx, gy, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.85);
  glow.addColorStop(0, rgba(col, 0.5));
  glow.addColorStop(0.45, rgba(SPEC[hash(title) % 8]!, 0.14));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, w, h);
  // la portada grande deja el símbolo arriba a la derecha (el título vive abajo a la izquierda)
  const cx = small ? w * 0.5 : w * (0.62 + r() * 0.08),
    cy = small ? h * 0.5 : h * 0.42,
    R = Math.min(w, h) * (small ? 0.34 : 0.3);
  c.globalCompositeOperation = 'lighter';
  MOTIF[intent](c, cx, cy, R, r, col);
  c.globalCompositeOperation = 'source-over';
  if (!small) {
    // marco de programa con línea guía, como las portadas de talleres de v2
    c.strokeStyle = 'rgba(255,255,255,.12)';
    c.lineWidth = 1;
    c.strokeRect(10.5, 10.5, w - 21, h - 21);
  }
  // grano fino
  for (let i = 0; i < (w * h) / 90; i++) {
    c.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
    c.fillRect(r() * w, r() * h, 1, 1);
  }
}

export function GenCover({ title, small = false, n }: { title: string; small?: boolean; n?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let lastW = 0;
    const paint = () => {
      if (Math.abs(cv.clientWidth - lastW) < 24) return;
      lastW = cv.clientWidth;
      draw(cv, title, small);
    };
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          paint();
          io.disconnect();
          ro.observe(cv);
        }
      },
      { rootMargin: '200px' },
    );
    const ro = new ResizeObserver(() => lastW && paint());
    io.observe(cv);
    return () => (io.disconnect(), ro.disconnect());
  }, [title, small]);
  const intent = intentOf(title);
  return (
    <span className={`cover-art${small ? ' sm' : ''}`} aria-hidden="true" style={{ '--cv-c': ICOL[intent] } as CSSProperties}>
      <canvas ref={ref} />
      {!small && (
        <>
          <i className="cv-n">IRB® · N° {String(n ?? (hash(title) % 40) + 1).padStart(2, '0')}</i>
          <b>{title}</b>
        </>
      )}
    </span>
  );
}
