import 'server-only';
import { EventEmitter } from 'node:events';
import postgres from 'postgres';
import { sql } from '@/db';
import { redis } from './redis';

/**
 * Un solo LISTEN por proceso web: Postgres NOTIFY ('subject', 'circle') → EventEmitter → cada stream SSE.
 * Así 1 000 alumnas conectadas siguen siendo 1 conexión de escucha.
 */
const g = globalThis as unknown as { hub?: EventEmitter; hubReady?: Promise<void> };
export const hub = g.hub ?? (g.hub = new EventEmitter().setMaxListeners(0));

export function ensureHub() {
  if (g.hubReady) return g.hubReady;
  const listener = postgres(process.env.DATABASE_URL!, { max: 1 });
  g.hubReady = Promise.all([
    listener.listen('subject', (p) => {
      try {
        const d = JSON.parse(p) as { subject: string };
        hub.emit(`s:${d.subject}`, p);
      } catch {}
    }),
    listener.listen('circle', (id) => hub.emit(`c:${id}`)),
    // UI Sinapsis: notificación nueva (payload = user_id)
    listener.listen('notify', (uid) => hub.emit(`n:${uid}`)),
  ]).then(() => undefined);
  return g.hubReady;
}

/* ─────────── presencia: "N personas practicando ahora" ─────────── */

const WINDOW_MS = 40_000;
export async function touchPresence(lessonId: number, connId: string) {
  const k = `presence:${lessonId}`;
  await redis.zadd(k, Date.now(), connId);
  await redis.zremrangebyscore(k, 0, Date.now() - WINDOW_MS);
  await redis.expire(k, 120);
}
export async function leavePresence(lessonId: number, connId: string) {
  await redis.zrem(`presence:${lessonId}`, connId);
}
export async function presenceCount(lessonId: number) {
  return redis.zcount(`presence:${lessonId}`, Date.now() - WINDOW_MS, '+inf');
}

/* ─────────── círculo: ranking por minutos de práctica (sorted set) ─────────── */

export async function circleFor(userId: string) {
  const [c] = await sql<{ id: number; name: string; week_start: string }[]>`
    select c.id, c.name, to_char(c.week_start, 'YYYY-MM-DD') week_start from circle_members m join circles c on c.id = m.circle_id
    where m.user_id = ${userId} order by c.week_start desc limit 1`;
  return c ?? null;
}

export async function circleRanking(circleId: number, me?: string) {
  let pairs = await redis.zrevrange(`circle:${circleId}`, 0, 29, 'WITHSCORES');
  if (!pairs.length) {
    // Redis vacío (reinicio): se reconstruye desde Postgres
    const rows = await sql<{ user_id: string; seconds: number }[]>`select user_id, seconds from circle_members where circle_id = ${circleId}`;
    if (rows.length) await redis.zadd(`circle:${circleId}`, ...rows.flatMap((r) => [r.seconds, r.user_id]));
    pairs = rows.sort((a, b) => b.seconds - a.seconds).flatMap((r) => [r.user_id, String(r.seconds)]);
  }
  const ids = pairs.filter((_, i) => i % 2 === 0);
  const names = ids.length ? await sql<{ id: string; name: string }[]>`select id, name from users where id in ${sql(ids)}` : [];
  const byId = new Map(names.map((n) => [n.id, n.name]));
  return ids.map((id, i) => ({ me: id === me, name: id === me ? 'Tú' : (byId.get(id) ?? 'Alguien').split(' ')[0]!, minutes: Math.floor(Number(pairs[i * 2 + 1]) / 60) }));
}
