import { z } from 'zod';
import { sql } from '@/db';
import { emit } from '@/server/events';
import { rateLimit, redis } from '@/server/redis';
import { subject as currentSubject } from '@/server/session';

const Body = z.object({
  lessonId: z.number().int().positive(),
  position: z.number().min(0).max(36000),
  playing: z.boolean(),
  seq: z.number().int().min(0).max(1e7),
});

/**
 * Ping de reproducción (cada 5 s mientras suena, al pausar y al ocultar la pestaña; también por sendBeacon).
 * Antitrampa: solo cuentan los segundos que avanzaron de forma continua y no más rápido que el reloj real (x2 de margen
 * para reproducción acelerada). Saltar al final no suma: el delta se descarta.
 */
export async function POST(req: Request) {
  const sub = await currentSubject();
  if (!sub) return Response.json({ error: 'sin_identidad' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'datos_invalidos' }, { status: 400 });
  const { lessonId, position, playing, seq } = parsed.data;
  if (!(await rateLimit(`prog:${sub}`, 40, 60))) return Response.json({ error: 'demasiadas_solicitudes' }, { status: 429 });

  const [lesson] = await sql<{ id: number; course_id: number; duration_s: number; media_type: string; is_free: boolean }[]>`
    select id, course_id, duration_s, media_type, is_free from lessons where id = ${lessonId}`;
  if (!lesson) return Response.json({ error: 'clase_no_existe' }, { status: 404 });
  if (sub.startsWith('a:') && !lesson.is_free) return Response.json({ error: 'requiere_cuenta' }, { status: 403 });

  // verificación con el ping anterior (Redis, 10 min)
  const key = `pp:${sub}:${lessonId}`;
  const now = Date.now();
  const prev = await redis.hgetall(key);
  let verified = 0;
  if (prev.t && prev.p) {
    const wall = (now - Number(prev.t)) / 1000;
    const adv = position - Number(prev.p);
    if (playing && adv > 0 && wall > 0 && wall <= 30 && adv <= wall * 2 + 1) verified = Math.round(Math.min(adv, wall));
  }
  const watched = await redis.hincrby(key, 'w', verified);
  await redis.hset(key, { t: String(now), p: String(position) });
  await redis.expire(key, 600);

  const duration = lesson.duration_s || 1;
  const percent = Math.min(100, Math.round((position / duration) * 100));
  await sql.begin(async (tx) => {
    let total = watched;
    if (sub.startsWith('u:')) {
      const [r] = await tx<{ watched_s: number }[]>`
        insert into lesson_progress (user_id, lesson_id, course_id, position_s, watched_s, percent, updated_at)
        values (${sub.slice(2)}, ${lessonId}, ${lesson.course_id}, ${Math.round(position)}, ${verified}, ${percent}, now())
        on conflict (user_id, lesson_id) do update set position_s = excluded.position_s,
          watched_s = lesson_progress.watched_s + excluded.watched_s, percent = greatest(lesson_progress.percent, excluded.percent), updated_at = now()
        returning watched_s`;
      total = r?.watched_s ?? watched;
    }
    if (verified > 0)
      await emit(tx, sub, 'media.progress', { lessonId, courseId: lesson.course_id, verified, watched: total, position: Math.round(position) }, `${sub}:p:${lessonId}:${seq}:${now}`);
  });
  return Response.json({ ok: true, verified, percent });
}
