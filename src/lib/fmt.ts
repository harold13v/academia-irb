/** mm:ss (o h:mm:ss) con ceros, para tiempos con tabular-nums. */
export function fmt(s: number) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}
export const minutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;
export const mediaLabel: Record<string, string> = { vimeo: 'Video', soundcloud: 'Audio', youtube: 'Video', spotify: 'Audio', gdoc: 'Documento', texto: 'Lectura' };
