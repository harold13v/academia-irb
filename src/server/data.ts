import 'server-only';
import { sql } from '@/db';
import { computeRun } from '@/lib/streak';
import { cached } from './redis';

export type OutlineLesson = { id: number; slug: string; title: string; mediaType: string; durationS: number; position: number; isFree: boolean };
export type Outline = { id: number; slug: string; title: string; subtitle: string; description: string; cover: string | null; kind: string; modules: { id: number; title: string; lessons: OutlineLesson[] }[]; totalS: number; count: number };

/** Temario completo de un curso: se cachea 10 min en Redis (cambia solo desde el admin). */
export function getOutline(courseSlug: string) {
  return cached<Outline | null>(`outline:${courseSlug}`, 600, async () => {
    const [c] = await sql<{ id: number; slug: string; title: string; subtitle: string; description: string; cover: string | null; kind: string }[]>`
      select id, slug, title, subtitle, description, cover, kind from courses where slug = ${courseSlug} and status = 'published'`;
    if (!c) return null;
    const rows = await sql<{ mid: number; mtitle: string; id: number; slug: string; title: string; media_type: string; duration_s: number; position: number; is_free: boolean }[]>`
      select m.id mid, m.title mtitle, l.id, l.slug, l.title, l.media_type, l.duration_s, l.position, l.is_free
      from modules m join lessons l on l.module_id = m.id where m.course_id = ${c.id} order by m.position, l.position`;
    const modules: Outline['modules'] = [];
    for (const r of rows) {
      let m = modules.at(-1);
      if (!m || m.id !== r.mid) modules.push((m = { id: r.mid, title: r.mtitle, lessons: [] }));
      m.lessons.push({ id: r.id, slug: r.slug, title: r.title, mediaType: r.media_type, durationS: r.duration_s, position: r.position, isFree: r.is_free });
    }
    return { ...c, modules, totalS: rows.reduce((a, r) => a + r.duration_s, 0), count: rows.length };
  });
}

export type LessonFull = {
  id: number; courseId: number; slug: string; title: string; subtitle: string; mediaType: string; mediaUrl: string | null;
  vimeoId: string | null; vimeoHash: string | null; poster: string | null; durationS: number; bodyHtml: string; prep: string[];
  isFree: boolean; playable: boolean; position: number; autoplayNext: boolean;
};

/** Datos de una clase. El hash privado de Vimeo solo se entrega si hay acceso (ver canAccess). */
export async function getLesson(courseId: number, lessonSlug: string) {
  const [l] = await sql<LessonFull[]>`
    select id, course_id "courseId", slug, title, subtitle, media_type "mediaType", media_url "mediaUrl", vimeo_id "vimeoId", vimeo_hash "vimeoHash",
           poster, duration_s "durationS", body_html "bodyHtml", prep, is_free "isFree", playable_in_staging playable, position, autoplay_next "autoplayNext"
    from lessons where course_id = ${courseId} and slug = ${lessonSlug}`;
  return l ?? null;
}

export async function canAccess(userId: string | null, courseId: number, isFree: boolean) {
  if (isFree) return true;
  if (!userId) return false;
  const [e] = await sql`select 1 from enrollments where user_id = ${userId} and course_id = ${courseId} and (expires_at is null or expires_at > now())`;
  return !!e;
}

export async function getCourseProgress(userId: string, courseId: number) {
  const rows = await sql<{ lesson_id: number; position_s: number; percent: number; completed: boolean }[]>`
    select lesson_id, position_s, percent, completed_at is not null completed from lesson_progress where user_id = ${userId} and course_id = ${courseId}`;
  return Object.fromEntries(rows.map((r) => [r.lesson_id, { positionS: r.position_s, percent: r.percent, completed: r.completed }])) as Record<number, { positionS: number; percent: number; completed: boolean }>;
}

export async function getNotes(userId: string, lessonId: number) {
  return sql<{ id: number; positionS: number; text: string; createdAt: Date }[]>`
    select id, position_s "positionS", text, created_at "createdAt" from notes where user_id = ${userId} and lesson_id = ${lessonId} order by created_at desc limit 100`;
}

export type Stats = { xp: number; level: number; levelName: string; nextThreshold: number | null; levelFloor: number; daysPracticed: number; currentRun: number; todaySeconds: number; goalSeconds: number };

export async function getStats(subject: string, goalMin = 10, tz = 'America/Bogota'): Promise<Stats> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const [s] = await sql<{ xp: number; level: number; days_practiced: number; current_run: number }[]>`select xp, level, days_practiced, current_run from subject_stats where subject = ${subject}`;
  const days = await sql<{ day: string; seconds: number }[]>`select to_char(day, 'YYYY-MM-DD') as day, seconds from practice_days where subject = ${subject} and day > ${today}::date - 400`;
  const d = days.find((x) => x.day === today);
  // el camino se calcula al leer: si pasaron días sin practicar, se ve al instante sin esperar un evento
  const { run } = computeRun(new Set(days.map((x) => x.day)), today);
  const lv = await sql<{ level: number; name: string; threshold: number }[]>`select level, name, threshold from levels order by level`;
  const level = s?.level ?? 1;
  const cur = lv.find((x) => x.level === level);
  const next = lv.find((x) => x.level === level + 1);
  return {
    xp: s?.xp ?? 0, level, levelName: cur?.name ?? 'Inicio', levelFloor: cur?.threshold ?? 0, nextThreshold: next?.threshold ?? null,
    daysPracticed: s?.days_practiced ?? 0, currentRun: run, todaySeconds: d?.seconds ?? 0, goalSeconds: goalMin * 60,
  };
}

export type MyCourse = { slug: string; title: string; cover: string | null; total: number; done: number; lastLessonSlug: string | null; lastLessonTitle: string | null; lastPosition: number; lastDuration: number; lastAt: Date | null };

export async function getMyCourses(userId: string) {
  return sql<MyCourse[]>`
    select c.slug, c.title, c.cover,
      (select count(*) from lessons l where l.course_id = c.id)::int total,
      (select count(*) from lesson_progress p where p.user_id = ${userId} and p.course_id = c.id and p.completed_at is not null)::int done,
      -- "Continuar": la última clase tocada si quedó a medias; si ya la completó, la siguiente pendiente
      coalesce(case when lp.completed then nx.slug end, lp.slug) "lastLessonSlug",
      coalesce(case when lp.completed then nx.title end, lp.title) "lastLessonTitle",
      case when lp.completed then 0 else coalesce(lp.position_s, 0) end "lastPosition",
      coalesce(case when lp.completed then nx.duration_s end, lp.duration_s, 0) "lastDuration", lp.updated_at "lastAt"
    from enrollments e join courses c on c.id = e.course_id
    left join lateral (
      select l.slug, l.title, l.position, p.position_s, l.duration_s, p.updated_at, p.completed_at is not null completed
      from lesson_progress p join lessons l on l.id = p.lesson_id
      where p.user_id = ${userId} and p.course_id = c.id order by p.updated_at desc limit 1
    ) lp on true
    left join lateral (
      select l.slug, l.title, l.duration_s from lessons l
      where l.course_id = c.id and l.position > lp.position
        and not exists (select 1 from lesson_progress q where q.user_id = ${userId} and q.lesson_id = l.id and q.completed_at is not null)
      order by l.position limit 1
    ) nx on true
    where e.user_id = ${userId} and c.kind = 'course'
    order by lp.updated_at desc nulls last, c.position`;
}

export async function getProfile(subject: string) {
  const achievements = await sql<{ key: string; title: string; description: string; earnedAt: Date | null }[]>`
    select a.key, a.title, a.description, u.earned_at "earnedAt" from achievements a left join user_achievements u on u.key = a.key and u.subject = ${subject} order by a.position`;
  const levels = await sql<{ level: number; name: string; threshold: number; unlockLabel: string | null }[]>`select level, name, threshold, unlock_label "unlockLabel" from levels order by level`;
  const days = await sql<{ day: string; seconds: number }[]>`
    select to_char(day, 'YYYY-MM-DD') as day, seconds from practice_days where subject = ${subject} and day > current_date - 84 order by day`;
  return { achievements, levels, days };
}
