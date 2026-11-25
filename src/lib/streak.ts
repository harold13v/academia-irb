/** YYYY-MM-DD ± n días (en UTC al mediodía, sin saltos por horario de verano). */
export const addDays = (day: string, n: number) => {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Camino actual con pausas: desde hoy hacia atrás, cada día sin práctica se cubre con una pausa si en ese mes
 * quedan (2 por mes). Hoy sin práctica no rompe nada (el día no ha terminado). Sin días practicados, el camino es 0.
 */
export function computeRun(days: Set<string>, today: string) {
  let run = 0;
  const used = new Map<string, number>();
  let d = days.has(today) ? today : addDays(today, -1);
  for (let i = 0; i < 400; i++) {
    if (days.has(d)) run++;
    else {
      const m = d.slice(0, 7);
      const u = used.get(m) ?? 0;
      if (u >= 2) break;
      used.set(m, u + 1);
    }
    d = addDays(d, -1);
  }
  return { run, pausesThisMonth: run ? (used.get(today.slice(0, 7)) ?? 0) : 0 };
}
