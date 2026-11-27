import { useId, type CSSProperties, type ReactNode } from 'react';
import { GenCover } from '../rayo/cover';

/** Material Symbols Rounded (subconjunto local, 20px, peso 400). `fill` para el estado activo. */
export function Icon({ name, fill, size, className = '', style, label }: { name: string; fill?: boolean; size?: number; className?: string; style?: CSSProperties; label?: string }) {
  return (
    <span className={`ms${fill ? ' fill' : ''} ${className}`} style={size ? { fontSize: size, width: size, height: size, ...style } : style} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined}>
      {name}
    </span>
  );
}

export type BtnVariant = 'primary' | 'tonal' | 'secondary' | 'tertiary' | 'outlined' | 'plain' | 'glass';
/** Clases de botón píldora: sm 28 / md 36 / lg 44. */
export const btn = (v: BtnVariant = 'primary', size: 'sm' | 'md' | 'lg' = 'md', extra = '') => `btn ${v}${size === 'md' ? '' : ' ' + size}${extra ? ' ' + extra : ''}`;

/** Barra de progreso: escala en X (sin animar width). */
export function Progress({ value, kind, label }: { value: number; kind?: 'goal' | 'thumb'; label?: string }) {
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className={`progress${kind ? ' ' + kind : ''}`} role={label ? 'progressbar' : undefined} aria-label={label} aria-valuenow={label ? Math.round(v * 100) : undefined} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined} aria-hidden={label ? undefined : true}>
      <span style={{ transform: `scaleX(${v})` }} />
    </div>
  );
}

export function Tag({ children, tone, md, icon }: { children: ReactNode; tone?: 'primary' | 'secondary' | 'tertiary' | 'warning' | 'error' | 'success' | 'info'; md?: boolean; icon?: string }) {
  return (
    <span className={`tag${md ? ' md' : ''}${tone ? ' ' + tone : ''}`}>
      {icon && <Icon name={icon} />}
      {children}
    </span>
  );
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export function Avatar({ name, size = 32, src }: { name: string; size?: 24 | 32 | 40 | 48 | 64; src?: string | null }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

export function Skeleton({ w, h, r, style }: { w?: number | string; h: number | string; r?: number; style?: CSSProperties }) {
  return <div className="skeleton" style={{ width: w ?? '100%', height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty" data-icon={icon}>
      <EmptyIllu />
      <b className="t-card" style={{ color: 'var(--sin-on-surface)' }}>
        {title}
      </b>
      {children && <p className="t-body-m">{children}</p>}
    </div>
  );
}

/** Loto de hito: pétalos con el color del tono (roles, no hex). */
export function Lotus({ tone = 'primary', size = 56 }: { tone?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'info'; size?: number }) {
  const c = `var(--sin-${tone})`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <g fill={c}>
        <path d="M32 10c6 8 8 16 0 30-8-14-6-22 0-30z" />
        <path d="M14 22c9 2 15 8 16 20-12-3-17-10-16-20z" opacity=".8" />
        <path d="M50 22c-9 2-15 8-16 20 12-3 17-10 16-20z" opacity=".8" />
        <path d="M6 36c9-2 17 1 24 8-10 4-19 2-24-8z" opacity=".6" />
        <path d="M58 36c-9-2-17 1-24 8 10 4 19 2 24-8z" opacity=".6" />
      </g>
      <path d="M14 50h36" stroke={c} strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}

/** Isotipo IRB: el rayo de v2 — un haz con los 8 colores del logo atravesando un anillo, sobre noche índigo. */
export function Isotype({ size = 28 }: { size?: number }) {
  // id único por instancia: con un id fijo, si la primera copia del SVG está oculta (sidebar en móvil) el degradado no pinta en las demás
  const gid = `irb-iso-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="isotype">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          {['#7A6CF0', '#E2574E', '#FF4A3D', '#FFD141', '#8BD336', '#3D8BFF', '#A35BD9', '#F196CE'].map((c, i) => (
            <stop key={c} offset={i / 7} stopColor={c} />
          ))}
        </linearGradient>
        <radialGradient id={`${gid}g`}>
          <stop offset="0" stopColor="#fff" stopOpacity=".9" />
          <stop offset="1" stopColor="#7A6CF0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="3" fill="#0d0b2e" />
      <rect x=".5" y=".5" width="31" height="31" rx="2.5" fill="none" stroke="#d6b27a" strokeOpacity=".45" />
      <circle cx="16" cy="16" r="9" fill={`url(#${gid}g)`} opacity=".35" />
      <rect x="15.2" y="4" width="1.6" height="24" rx=".8" fill={`url(#${gid})`} />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="#f3efe6" strokeWidth="1.1" opacity=".9" />
      <circle cx="16" cy="16" r="1.8" fill="#fff" />
    </svg>
  );
}

/** Portada generada (arte generativo de v2 por intención + título en Bodoni). Va debajo de la imagen real: si falta o falla, se ve esta. */
export function CoverArt({ title, small, n }: { title: string; small?: boolean; n?: number }) {
  return <GenCover title={title} small={small} n={n} />;
}

/** Ilustración propia para estados vacíos (anillos + loto). */
export function EmptyIllu() {
  return (
    <svg className="illu" viewBox="0 0 120 96" aria-hidden="true">
      <circle cx="60" cy="52" r="40" fill="none" stroke="var(--sin-outline-variant)" strokeDasharray="3 6" />
      <circle cx="60" cy="52" r="26" fill="var(--sin-surface-container-high)" />
      <g fill="var(--sin-secondary)" transform="translate(44 34)">
        <path d="M16 4c3 4 4 8 0 15-4-7-3-11 0-15z" />
        <path d="M5 10c4.5 1 7.5 4 8 10-6-1.5-8.5-5-8-10z" opacity=".7" />
        <path d="M27 10c-4.5 1-7.5 4-8 10 6-1.5 8.5-5 8-10z" opacity=".7" />
      </g>
      <circle cx="98" cy="20" r="3" fill="var(--sin-primary)" />
      <circle cx="20" cy="78" r="2" fill="var(--sin-tertiary)" />
    </svg>
  );
}
