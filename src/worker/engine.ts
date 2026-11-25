/**
 * Motor de gamificación. Lo ejecuta SOLO el worker, una vez por evento del outbox.
 * Todo es idempotente: el XP entra al ledger con idempotency_key única y el estado se recalcula desde ahí.
 */
import type { TransactionSql } from 'postgres';
import type Redis from 'ioredis';
import { computeRun } from '../lib/streak';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = TransactionSql<any>; // siempre se ejecuta dentro de la transacción del worker
type Ev = { id: number; subject: string; name: string; props: Record<string, unknown>; ts: Date };

export type Delta = {
  subject: string;
  gained: number;
  xp: number;
  level: number;
  levelName: string;
  levelUp: boolean;
  unlock: string | null;
  achievements: { key: string; title: string }[];
  daysPracticed: number;
  currentRun: number;
  todaySeconds: number;
  goalSeconds: number;
  goalMetNow: boolean;
  reason: string | null;
};

let rulesCache: { at: number; rules: Map<string, number> } | null = null;
async function rules(sql: Tx) {
  if (rulesCache && Date.now() - rulesCache.at < 30_000) return rulesCache.rules;
  const rows = await sql<{ key: string; amount: number }[]>`select key, amount from gamification_rules where enabled`;
  rulesCache = { at: Date.now(), rules: new Map(rows.map((r) => [r.key, r.amount])) };
  return rulesCache.rules;
}

/** Día calendario local (YYYY-MM-DD) de una fecha en una zona horaria. */
export const localDay = (d: Date, tz: string) => d.toLocaleDateString('en-CA', { timeZone: tz });
export const weekStart = (day: string) => {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

async function grant(sql: Tx, subject: string, source: string, amount: number | undefined, idem: string, refId: string | null, ts: Date) {
  if (!amount) return 0;
  const r = await sql`insert into xp_ledger (subject, source, ref_id, amount, idempotency_key, ts)
    values (${subject}, ${source}, ${refId}, ${amount}, ${idem}, ${ts}) on conflict (idempotency_key) do nothing returning amount`;
  return r.length ? amount : 0;
}

async function profile(sql: Tx, subject: string) {
  if (!subject.startsWith('u:')) return { tz: 'America/Bogota', goalMin: 10, circles: false, userId: null as string | null };
  const [u] = await sql<{ timezone: string; daily_goal_min: number; circles_opt_in: boolean }[]>`select timezone, daily_goal_min, circles_opt_in from users where id = ${subject.slice(2)}`;
  return { tz: u?.timezone ?? 'America/Bogota', goalMin: u?.daily_goal_min ?? 10, circles: !!u?.circles_opt_in, userId: subject.slice(2) };
}

export async function processEvent(sql: Tx, redis: Redis, ev: Ev): Promise<Delta | null> {
  const R = await rules(sql);
  const p = await profile(sql, ev.subject);
  const day = localDay(ev.ts, p.tz);
  let gained = 0;
  let goalMetNow = false;
  let reason: string | null = null;
  const lessonId = Number(ev.props.lessonId ?? 0) || null;

  switch (ev.name) {
    case 'media.progress': {
      // un ping verificado nunca trae más de 30 s; solo los scripts del servidor (backfill) cargan historia más larga
      const secs = Math.max(0, Math.min(ev.props.backfill ? 7200 : 30, Number(ev.props.verified ?? 0)));
      const watched = Number(ev.props.watched ?? 0);
      if (secs > 0) {
        const [pd] = await sql<{ seconds: number; goal_met: boolean }[]>`
          insert into practice_days (subject, day, seconds) values (${ev.subject}, ${day}, ${secs})
          on conflict (subject, day) do update set seconds = practice_days.seconds + excluded.seconds
          returning seconds, goal_met`;
        // XP por minuto verificado de esa clase: idempotente por minuto
        const minutes = Math.floor(watched / 60);
        if (minutes > 0 && R.get('media_minute')) {
          const r = await sql`insert into xp_ledger (subject, source, ref_id, amount, idempotency_key, ts)
            select ${ev.subject}, 'media_minute', ${String(lessonId)}, ${R.get('media_minute')!}, ${ev.subject} || ':min:' || ${String(lessonId)} || ':' || g, ${ev.ts}
            from generate_series(1, ${minutes}) g on conflict (idempotency_key) do nothing returning amount`;
          gained += r.reduce((a, x) => a + Number(x.amount), 0);
          if (r.length) reason = 'Minutos de práctica';
        }
        if (pd && !pd.goal_met && pd.seconds >= p.goalMin * 60) {
          await sql`update practice_days set goal_met = true where subject = ${ev.subject} and day = ${day}`;
          gained += await grant(sql, ev.subject, 'daily_goal', R.get('daily_goal'), `${ev.subject}:goal:${day}`, day, ev.ts);
          goalMetNow = true;
          reason = 'Meta del día cumplida';
        }
        if (p.circles && p.userId) {
          const wk = weekStart(day);
          const [m] = await sql<{ circle_id: number }[]>`select cm.circle_id from circle_members cm join circles c on c.id = cm.circle_id where cm.user_id = ${p.userId} and c.week_start = ${wk}`;
          if (m) {
            await sql`update circle_members set seconds = seconds + ${secs} where circle_id = ${m.circle_id} and user_id = ${p.userId}`;
            await redis.zincrby(`circle:${m.circle_id}`, secs, p.userId);
            await redis.expire(`circle:${m.circle_id}`, 60 * 60 * 24 * 10);
            await sql`select pg_notify('circle', ${String(m.circle_id)})`;
          }
        }
      }
      break;
    }
    case 'lesson.completed': {
      const media = String(ev.props.mediaType ?? 'texto');
      const watched = Number(ev.props.watched ?? 0);
      const duration = Number(ev.props.duration ?? 0);
      // antitrampa: sin haber reproducido al menos la mitad, se marca completada pero no da XP
      const legit = media === 'texto' || media === 'gdoc' || duration === 0 || watched >= duration * 0.5;
      if (legit) {
        const key = media === 'texto' || media === 'gdoc' ? 'reading_complete' : 'lesson_complete';
        const g = await grant(sql, ev.subject, key, R.get(key), `${ev.subject}:done:${lessonId}`, String(lessonId), ev.ts);
        gained += g;
        if (g) reason = 'Clase completada';
        if (media === 'texto' || media === 'gdoc')
          await sql`insert into practice_days (subject, day, seconds) values (${ev.subject}, ${day}, 0) on conflict do nothing`;
      }
      const courseId = Number(ev.props.courseId ?? 0);
      if (courseId && p.userId) {
        const [c] = await sql<{ total: number; done: number }[]>`
          select (select count(*) from lessons where course_id = ${courseId})::int total,
                 (select count(*) from lesson_progress where user_id = ${p.userId} and course_id = ${courseId} and completed_at is not null)::int done`;
        if (c && c.total > 1 && c.done >= c.total) {
          const g = await grant(sql, ev.subject, 'course_complete', R.get('course_complete'), `${ev.subject}:course:${courseId}`, String(courseId), ev.ts);
          gained += g;
          if (g) reason = 'Curso completado';
        }
      }
      break;
    }
    case 'note.created': {
      const [{ n }] = (await sql<{ n: number }[]>`select count(*)::int n from xp_ledger where subject = ${ev.subject} and source = 'note' and ts > ${ev.ts}::timestamptz - interval '1 day'`) as unknown as [{ n: number }];
      if (n < 5) gained += await grant(sql, ev.subject, 'note', R.get('note'), `${ev.subject}:note:${ev.props.noteId}`, String(ev.props.noteId), ev.ts);
      break;
    }
    default:
      return null; // eventos de analítica: solo quedan registrados
  }

  return recompute(sql, ev.subject, p.tz, p.goalMin, gained, goalMetNow, reason, ev.ts);
}

/** Recalcula y materializa subject_stats; otorga logros nuevos (con su XP). */
export async function recompute(sql: Tx, subject: string, tz: string, goalMin: number, gained: number, goalMetNow: boolean, reason: string | null, at = new Date()): Promise<Delta> {
  const today = localDay(new Date(), tz);
  const [prev] = await sql<{ level: number }[]>`select level from subject_stats where subject = ${subject}`;
  const dayRows = await sql<{ day: string; seconds: number; goal_met: boolean }[]>`
    select to_char(day, 'YYYY-MM-DD') as day, seconds, goal_met from practice_days where subject = ${subject} and day > ${today}::date - 400`;
  const days = new Set(dayRows.map((r) => r.day));
  const { run, pausesThisMonth } = computeRun(days, today);
  const [counts] = await sql<{ lessons: number; notes: number; courses: number; total_days: number; goal_days: number }[]>`
    select (select count(*) from xp_ledger where subject = ${subject} and source in ('lesson_complete','reading_complete'))::int lessons,
           (select count(*) from xp_ledger where subject = ${subject} and source = 'note')::int notes,
           (select count(*) from xp_ledger where subject = ${subject} and source = 'course_complete')::int courses,
           (select count(*) from practice_days where subject = ${subject})::int total_days,
           (select count(*) from practice_days where subject = ${subject} and goal_met)::int goal_days`;
  const metric: Record<string, number> = {
    days_practiced: counts!.total_days,
    lessons_completed: counts!.lessons,
    notes: counts!.notes,
    course_completed: counts!.courses,
    goal_days: counts!.goal_days,
  };

  const earned: { key: string; title: string }[] = [];
  const catalog = await sql<{ key: string; title: string; rule: { type: string; gte: number }; xp: number }[]>`
    select a.key, a.title, a.rule, a.xp from achievements a where not exists (select 1 from user_achievements u where u.subject = ${subject} and u.key = a.key)`;
  for (const a of catalog) {
    if ((metric[a.rule.type] ?? 0) >= a.rule.gte) {
      const ins = await sql`insert into user_achievements (subject, key, earned_at) values (${subject}, ${a.key}, ${at}) on conflict do nothing returning key`;
      if (ins.length) {
        earned.push({ key: a.key, title: a.title });
        gained += await grant(sql, subject, 'achievement', a.xp, `${subject}:ach:${a.key}`, a.key, at);
      }
    }
  }

  const [{ xp }] = (await sql<{ xp: number }[]>`select coalesce(sum(amount), 0)::int xp from xp_ledger where subject = ${subject}`) as unknown as [{ xp: number }];
  const [lv] = await sql<{ level: number; name: string }[]>`select level, name from levels where threshold <= ${xp} order by level desc limit 1`;
  const level = lv?.level ?? 1;
  const levelUp = !!prev && level > prev.level;
  let unlock: string | null = null;
  if (levelUp) {
    const [u] = await sql<{ unlock_label: string | null }[]>`select unlock_label from levels where level = ${level}`;
    unlock = u?.unlock_label ?? null;
  }
  const lastDay = [...days].sort().at(-1) ?? null;
  await sql`insert into subject_stats (subject, xp, level, days_practiced, current_run, best_run, pauses_used_month, last_practice_day, updated_at)
    values (${subject}, ${xp}, ${level}, ${counts!.total_days}, ${run}, ${run}, ${pausesThisMonth}, ${lastDay}, now())
    on conflict (subject) do update set xp = excluded.xp, level = excluded.level, days_practiced = excluded.days_practiced,
      current_run = excluded.current_run, best_run = greatest(subject_stats.best_run, excluded.current_run),
      pauses_used_month = excluded.pauses_used_month, last_practice_day = excluded.last_practice_day, updated_at = now()`;

  const todaySeconds = dayRows.find((r) => r.day === today)?.seconds ?? 0;
  return {
    subject, gained, xp, level, levelName: lv?.name ?? 'Inicio', levelUp, unlock, achievements: earned,
    daysPracticed: counts!.total_days, currentRun: run, todaySeconds, goalSeconds: goalMin * 60, goalMetNow, reason,
  };
}
