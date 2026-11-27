import { Fragment, type CSSProperties, type JSX } from 'react';

/**
 * Titular editorial de v2: Bodoni Moda en caja normal, palabras que suben desde una máscara al aparecer
 * y el remate en cursiva dorada ("Transforma el miedo / *en amor.*"). Se renderiza en el servidor: la animación es CSS,
 * corre desde el primer pintado y no espera la hidratación.
 * - `em`: texto del remate en cursiva dorada.
 * - `auto`: en títulos dinámicos (cursos, clases), la última palabra pasa a cursiva dorada si tiene al menos 4 letras.
 */
export function Title({ as: Tag = 'h1', text, em, auto, className = '', id, style }: { as?: keyof JSX.IntrinsicElements; text: string; em?: string; auto?: boolean; className?: string; id?: string; style?: CSSProperties }) {
  let lead = text.trim();
  let tail = em;
  if (!tail && auto) {
    const m = lead.match(/^(.*\S)\s+([\p{L}][\p{L}\p{M}'’-]{3,}[.!?…]?)$/u);
    if (m) {
      lead = m[1]!;
      tail = m[2]!;
    }
  }
  let i = 0;
  const words = (s: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .map((w, k) => (
        // el espacio va fuera de la máscara: dentro de un inline-block se colapsaría
        <Fragment key={`${i}-${k}`}>
          {k > 0 && ' '}
          <span className="w">
            <span className="wi" style={{ '--i': i++ } as CSSProperties}>
              {w}
            </span>
          </span>
        </Fragment>
      ));
  return (
    <Tag className={`r-title ${className}`} id={id} style={style}>
      {words(lead)}
      {tail && (
        <>
          {' '}
          <em className="r-em">{words(tail)}</em>
        </>
      )}
    </Tag>
  );
}

/** Rótulo de sección de v2: cursiva serif con filete dorado. */
export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`r-eyebrow ${className}`}>{children}</p>;
}
