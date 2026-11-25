import 'server-only';
import { sql } from '@/db';
import { addDays } from '@/lib/streak';

/* ───────────── racha SEMANAL sobre practice_days (no cambia el motor) ───────────── */

export const weekStartOf = (day: string) => {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

export type WeekDay = { day: string; label: string; state: 'done' | 'today' | 'risk' | 'future' | 'off' };
export type WeeklyStreak = { weeks: number; thisWeekDone: boolean; days: WeekDay[]; totalDays: number; pausedThisWeek: boolean; pausesLeftMonth: number; hidden: boolean };

/** Semanas consecutivas con al menos un día de práctica (o pausadas). La semana en curso no rompe la racha. */
export async function getWeeklyStreak(subject: string, tz: string, hidden = false): Promise<WeeklyStreak> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const [rows, pauses] = await Promise.all([
    sql<{ day: string }[]>`select to_char(day, 'YYYY-MM-DD') as day from practice_days where subject = ${subject} and day > ${today}::date - 800`,
    sql<{ week_start: string }[]>`select to_char(week_start, 'YYYY-MM-DD') as week_start from streak_week_pauses where subject = ${subject}`,
  ]);
  const days = new Set(rows.map((r) => r.day));
  const practicedWeeks = new Set(rows.map((r) => weekStartOf(r.day)));
  const paused = new Set(pauses.map((p) => p.week_start));
  const cur = weekStartOf(today);
  const thisWeekDone = practicedWeeks.has(cur);
  let weeks = thisWeekDone || paused.has(cur) ? 1 : 0;
  let w = addDays(cur, -7);
  while (practicedWeeks.has(w) || paused.has(w)) {
    weeks++;
    w = addDays(w, -7);
  }
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const weekDays: WeekDay[] = labels.map((label, i) => {
    const day = addDays(cur, i);
    const state: WeekDay['state'] = days.has(day) ? 'done' : day === today ? (thisWeekDone ? 'today' : 'risk') : day > today ? 'future' : 'off';
    return { day, label, state };
  });
  const monthPauses = pauses.filter((p) => p.week_start.slice(0, 7) === today.slice(0, 7)).length;
  return { weeks, thisWeekDone, days: weekDays, totalDays: days.size, pausedThisWeek: paused.has(cur), pausesLeftMonth: Math.max(0, 1 - monthPauses), hidden };
}

/** Hitos estilo Insight Timer: 7 días seguidos o 50 totales (y siguientes). */
export function milestones(totalDays: number, bestRun: number) {
  const defs = [
    { key: 'run7', label: '7 días seguidos', done: bestRun >= 7, tone: 'secondary' },
    { key: 'total50', label: '50 días de práctica', done: totalDays >= 50, tone: 'primary' },
    { key: 'run21', label: '21 días seguidos', done: bestRun >= 21, tone: 'tertiary' },
    { key: 'total100', label: '100 días de práctica', done: totalDays >= 100, tone: 'success' },
    { key: 'total365', label: '365 días de práctica', done: totalDays >= 365, tone: 'info' },
  ] as const;
  return defs;
}

/* ───────────── círculo: presencia del día, sin ranking ───────────── */

export async function circleToday(userId: string, tz: string) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const [c] = await sql<{ id: number; name: string }[]>`
    select c.id, c.name from circle_members m join circles c on c.id = m.circle_id where m.user_id = ${userId} order by c.week_start desc limit 1`;
  if (!c) return null;
  const rows = await sql<{ name: string; me: boolean }[]>`
    select u.name, u.id = ${userId} as me from circle_members m join users u on u.id = m.user_id
    join practice_days d on d.subject = 'u:' || u.id and d.day = ${today}
    where m.circle_id = ${c.id}`;
  const [{ size }] = (await sql<{ size: number }[]>`select count(*)::int size from circle_members where circle_id = ${c.id}`) as unknown as [{ size: number }];
  return { id: c.id, name: c.name, size, practicedToday: rows.filter((r) => !r.me).map((r) => r.name.split(' ')[0]!), meToday: rows.some((r) => r.me) };
}

/* ───────────── comentarios ───────────── */

export type CommentRow = {
  id: number; parentId: number | null; kind: string; body: string; likes: number; createdAt: Date;
  author: string; badge: string | null; stage: string; liked: boolean; fav: boolean; mine: boolean; replies: number;
};

export async function getComments(lessonId: number, viewer: string | null, filter = 'todo', sort = 'votos') {
  const where =
    filter === 'aportes' ? sql`and c.kind = 'aporte'` : filter === 'preguntas' ? sql`and c.kind = 'pregunta'`
    : filter === 'sin-responder' ? sql`and c.kind = 'pregunta' and not exists (select 1 from comments r where r.parent_id = c.id)`
    : filter === 'favoritos' && viewer ? sql`and exists (select 1 from comment_favorites f where f.comment_id = c.id and f.user_id = ${viewer})` : sql``;
  const order = sort === 'nuevos' ? sql`c.created_at desc` : sql`c.likes desc, c.created_at desc`;
  const v = viewer ?? '00000000-0000-0000-0000-000000000000';
  const rows = await sql<CommentRow[]>`
    select c.id, c.parent_id "parentId", c.kind, c.body, c.likes, c.created_at "createdAt",
      u.name author, u.staff_badge badge, coalesce(lv.name, 'Inicio') stage,
      exists (select 1 from comment_likes l where l.comment_id = c.id and l.user_id = ${v}) liked,
      exists (select 1 from comment_favorites f where f.comment_id = c.id and f.user_id = ${v}) fav,
      c.user_id = ${v} mine,
      (select count(*)::int from comments r where r.parent_id = c.id) replies
    from comments c join users u on u.id = c.user_id
    left join subject_stats s on s.subject = 'u:' || u.id
    left join levels lv on lv.level = coalesce(s.level, 1)
    where c.lesson_id = ${lessonId} and (c.parent_id is null ${where}) or (c.lesson_id = ${lessonId} and c.parent_id is not null)
    order by ${order} limit 200`;
  const [{ total }] = (await sql<{ total: number }[]>`select count(*)::int total from comments where lesson_id = ${lessonId}`) as unknown as [{ total: number }];
  return { rows, total };
}

/* ───────────── notificaciones ───────────── */

export type NotificationRow = { id: number; kind: string; title: string; body: string; href: string | null; readAt: Date | null; createdAt: Date };

export async function getNotifications(userId: string, filter = 'todas') {
  const where = filter === 'sin-leer' ? sql`and read_at is null` : ['comment', 'practice', 'circle'].includes(filter) ? sql`and kind = ${filter}` : sql``;
  const rows = await sql<NotificationRow[]>`
    select id, kind, title, body, href, read_at "readAt", created_at "createdAt" from notifications where user_id = ${userId} ${where} order by created_at desc limit 50`;
  const [{ unread }] = (await sql<{ unread: number }[]>`select count(*)::int unread from notifications where user_id = ${userId} and read_at is null`) as unknown as [{ unread: number }];
  return { rows, unread };
}
