import 'server-only';
import { sql } from '@/db';

export type ContinueItem = { href: string; title: string; course: string; cover: string | null; poster: string | null; positionS: number; durationS: number };

/** "Continúa aprendiendo": clases empezadas y no terminadas, la más reciente primero. */
export function getContinue(userId: string) {
  return sql<ContinueItem[]>`
    select '/cursos/' || c.slug || '/' || l.slug href, l.title, c.title course, c.cover, l.poster, p.position_s "positionS", l.duration_s "durationS"
    from lesson_progress p join lessons l on l.id = p.lesson_id join courses c on c.id = l.course_id
    where p.user_id = ${userId} and p.completed_at is null and p.position_s > 0 and c.kind = 'course'
    order by p.updated_at desc limit 12`;
}

/** Cuántos módulos tiene cada curso (los de 3+ se muestran como programa, con tarjetas apiladas). */
export async function moduleCounts() {
  const rows = await sql<{ slug: string; n: number }[]>`select c.slug, count(m.id)::int n from courses c join modules m on m.course_id = c.id group by c.slug`;
  return Object.fromEntries(rows.map((r) => [r.slug, r.n])) as Record<string, number>;
}

/** Racha más larga de días seguidos (para los hitos "7 seguidos" y "21 seguidos"). */
export async function bestRun(subject: string) {
  const rows = await sql<{ day: string }[]>`select to_char(day, 'YYYY-MM-DD') as day from practice_days where subject = ${subject} order by day`;
  let best = 0;
  let run = 0;
  let prev = 0;
  for (const r of rows) {
    const t = Date.parse(r.day + 'T12:00:00Z') / 86_400_000;
    run = t - prev === 1 ? run + 1 : 1;
    prev = t;
    best = Math.max(best, run);
  }
  return best;
}

export type CatalogItem = { slug: string; title: string; subtitle: string; cover: string | null; kind: string; total: number; done: number; enrolled: boolean; modules: number; totalS: number };

export function getCatalog(userId: string | null) {
  const u = userId ?? '00000000-0000-0000-0000-000000000000';
  return sql<CatalogItem[]>`
    select c.slug, c.title, c.subtitle, c.cover, c.kind,
      (select count(*)::int from lessons l where l.course_id = c.id) total,
      (select count(*)::int from lesson_progress p where p.user_id = ${u} and p.course_id = c.id and p.completed_at is not null) done,
      exists (select 1 from enrollments e where e.user_id = ${u} and e.course_id = c.id and (e.expires_at is null or e.expires_at > now())) enrolled,
      (select count(*)::int from modules m where m.course_id = c.id) modules,
      (select coalesce(sum(duration_s), 0)::int from lessons l where l.course_id = c.id) "totalS"
    from courses c where c.status = 'published' order by c.kind = 'practice' desc, c.position`;
}
