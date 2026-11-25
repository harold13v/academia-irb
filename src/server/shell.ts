import 'server-only';
import { sql } from '@/db';
import { cached } from './redis';
import { currentUser } from './session';
import { getWeeklyStreak, type WeeklyStreak } from './social';

export type SearchItem = { group: 'Curso' | 'Clase' | 'Práctica' | 'Círculo'; title: string; sub: string; href: string; cover: string | null };
export type ShellData = {
  user: { id: string; name: string; email: string; hideStreak: boolean; reminderHour: number | null } | null;
  streak: WeeklyStreak | null;
  unread: number;
  index: SearchItem[];
  next: { href: string; title: string } | null;
};

/** Índice para ⌘K: catálogo publicado (no depende de la persona, se cachea 10 min). */
const searchIndex = () =>
  cached<SearchItem[]>('search-index:v1', 600, async () => {
    const cs = await sql<{ slug: string; title: string; cover: string | null; kind: string; n: number }[]>`
      select c.slug, c.title, c.cover, c.kind, (select count(*)::int from lessons l where l.course_id = c.id) n
      from courses c where c.status = 'published' order by c.position`;
    const ls = await sql<{ cslug: string; ctitle: string; cover: string | null; kind: string; slug: string; title: string; duration_s: number }[]>`
      select c.slug cslug, c.title ctitle, c.cover, c.kind, l.slug, l.title, l.duration_s
      from lessons l join courses c on c.id = l.course_id where c.status = 'published' order by c.position, l.position`;
    return [
      ...cs.map((c) => ({ group: c.kind === 'practice' ? ('Práctica' as const) : ('Curso' as const), title: c.title, sub: c.kind === 'practice' ? 'Práctica guiada gratuita' : `${c.n} clases`, href: c.kind === 'practice' ? `/practicas/${c.slug}` : `/cursos/${c.slug}`, cover: c.cover })),
      ...ls.filter((l) => l.kind !== 'practice').map((l) => ({ group: 'Clase' as const, title: l.title, sub: `${l.ctitle} · ${Math.max(1, Math.round(l.duration_s / 60))} min`, href: `/cursos/${l.cslug}/${l.slug}`, cover: l.cover })),
    ];
  });

export async function getShellData(): Promise<ShellData> {
  const user = await currentUser();
  const index = await searchIndex();
  if (!user) return { user: null, streak: null, unread: 0, index, next: { href: '/practicas/fuegos', title: 'Fuegos' } };
  const [streak, [u], circle, [nx]] = await Promise.all([
    getWeeklyStreak(`u:${user.id}`, user.timezone, user.hideStreak),
    sql<{ n: number }[]>`select count(*)::int n from notifications where user_id = ${user.id} and read_at is null`,
    sql<{ name: string }[]>`select c.name from circle_members m join circles c on c.id = m.circle_id where m.user_id = ${user.id} order by c.week_start desc limit 1`,
    sql<{ cslug: string; slug: string; title: string }[]>`
      select c.slug cslug, l.slug, l.title from lesson_progress p join lessons l on l.id = p.lesson_id join courses c on c.id = l.course_id
      where p.user_id = ${user.id} and c.kind = 'course' order by p.updated_at desc limit 1`,
  ]);
  return {
    user: { id: user.id, name: user.name, email: user.email, hideStreak: user.hideStreak, reminderHour: user.reminderHour ?? null },
    streak,
    unread: u?.n ?? 0,
    index: circle[0] ? [...index, { group: 'Círculo', title: circle[0].name, sub: 'Tu círculo de práctica', href: '/circulos', cover: null }] : index,
    next: nx ? { href: `/cursos/${nx.cslug}/${nx.slug}`, title: nx.title } : { href: '/practicas/fuegos', title: 'Fuegos' },
  };
}
