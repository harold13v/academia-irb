/**
 * Worker: outbox → BullMQ → motor de gamificación → NOTIFY 'subject' (lo empuja el SSE).
 *   LISTEN outbox     despierta al instante con cada evento nuevo
 *   barrido cada 10 s recoge lo que se haya perdido (reinicios, NOTIFY sin oyente)
 *   jobId = ev-<id>   BullMQ no encola dos veces el mismo evento; el ledger es idempotente de todas formas
 */
import { Queue, Worker } from 'bullmq';
import webpush from 'web-push';
import Redis from 'ioredis';
import pino from 'pino';
import postgres from 'postgres';
import { localDay, processEvent, weekStart } from './engine';

const log = pino({ base: { app: 'worker' }, timestamp: pino.stdTimeFunctions.isoTime });
const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
const listener = postgres(process.env.DATABASE_URL!, { max: 1 });
const conn = { url: process.env.REDIS_URL! };
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
const queue = new Queue('outbox', { connection: conn, defaultJobOptions: { removeOnComplete: 2000, removeOnFail: 5000, attempts: 5, backoff: { type: 'exponential', delay: 2000 } } });

async function enqueue(id: number) {
  await queue.add('event', { id }, { jobId: `ev-${id}` });
}

/** Círculo semanal opt-in: primer círculo de la semana con cupo (< 30), o uno nuevo. */
async function ensureCircle(userId: string, day: string) {
  const wk = weekStart(day);
  const [has] = await sql`select 1 from circle_members cm join circles c on c.id = cm.circle_id where cm.user_id = ${userId} and c.week_start = ${wk}`;
  if (has) return;
  await sql.begin(async (tx) => {
    let [c] = await tx<{ id: number }[]>`select id from circles where week_start = ${wk} and size < 30 order by id limit 1 for update`;
    if (!c) {
      const [{ n }] = (await tx<{ n: number }[]>`select count(*)::int n from circles where week_start = ${wk}`) as unknown as [{ n: number }];
      [c] = await tx<{ id: number }[]>`insert into circles (week_start, name, size) values (${wk}, ${'Círculo ' + (n + 1)}, 0) returning id`;
    }
    await tx`insert into circle_members (circle_id, user_id) values (${c!.id}, ${userId}) on conflict do nothing`;
    await tx`update circles set size = (select count(*) from circle_members where circle_id = ${c!.id}) where id = ${c!.id}`;
  });
}

const worker = new Worker(
  'outbox',
  async (job) => {
    const id = Number(job.data.id);
    const delta = await sql.begin(async (tx) => {
      const [ev] = await tx<{ id: number; subject: string; name: string; props: Record<string, unknown>; ts: Date }[]>`
        select id, subject, name, props, ts from events where id = ${id} and processed_at is null for update skip locked`;
      if (!ev) return null; // ya procesado u otro worker lo tiene
      if (ev.name === 'media.progress' && ev.subject.startsWith('u:')) {
        const [u] = await tx<{ circles_opt_in: boolean; timezone: string }[]>`select circles_opt_in, timezone from users where id = ${ev.subject.slice(2)}`;
        if (u?.circles_opt_in) await ensureCircle(ev.subject.slice(2), localDay(ev.ts, u.timezone));
      }
      if (ev.name === 'circles.joined' && ev.subject.startsWith('u:')) await ensureCircle(ev.subject.slice(2), localDay(ev.ts, 'America/Bogota'));
      // UI Sinapsis: una respuesta avisa a la autora del comentario original
      if (ev.name === 'comment.created' && ev.props.parentId) {
        await tx`insert into notifications (user_id, kind, title, body, href)
          select p.user_id, 'comment', u.name || ' respondió tu comentario', left(c.body, 140), '/cursos/' || co.slug || '/' || l.slug
          from comments c join comments p on p.id = c.parent_id join users u on u.id = c.user_id
          join lessons l on l.id = c.lesson_id join courses co on co.id = l.course_id
          where c.id = ${Number(ev.props.commentId)} and p.user_id <> c.user_id`;
      }
      const d = await processEvent(tx, redis, ev);
      await tx`update events set processed_at = now(), error = null where id = ${ev.id}`;
      if (d) await tx`select pg_notify('subject', ${JSON.stringify(d)})`;
      return d;
    });
    if (delta?.gained) log.info({ ev: id, gained: delta.gained, level: delta.level }, 'xp');
  },
  { connection: conn, concurrency: 4 },
);

worker.on('failed', async (job, err) => {
  log.error({ ev: job?.data?.id, err: err.message }, 'evento falló');
  if (job?.data?.id) await sql`update events set error = ${err.message.slice(0, 500)} where id = ${job.data.id}`.catch(() => {});
});

async function sweep() {
  const rows = await sql<{ id: number }[]>`select id from events where processed_at is null order by id limit 500`;
  for (const r of rows) await enqueue(r.id);
  return rows.length;
}

// un jobId que quedó en 'failed' bloquea su reencolado: se limpian al arrancar (el error queda en events.error)
await queue.clean(0, 10_000, 'failed');
await listener.listen('outbox', (payload) => void enqueue(Number(payload)).catch((e) => log.error(e)));
const pending = await sweep();
log.info({ pending }, 'worker listo');
const timer = setInterval(() => void sweep().catch((e) => log.error(e)), 10_000);

/* ───────── UI Sinapsis: recordatorio diario a la hora que eligió la alumna (máximo 1 al día) ───────── */
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
async function reminders() {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) return;
  const due = await sql<{ endpoint: string; p256dh: string; auth: string; name: string; today: string }[]>`
    select s.endpoint, s.p256dh, s.auth, u.name, to_char((now() at time zone u.timezone)::date, 'YYYY-MM-DD') today
    from push_subscriptions s join users u on u.id = s.user_id
    where u.reminder_hour = extract(hour from now() at time zone u.timezone)
      and (s.last_sent_day is null or s.last_sent_day < (now() at time zone u.timezone)::date)
      and not exists (select 1 from practice_days d where d.subject = 'u:' || u.id and d.day = (now() at time zone u.timezone)::date)`;
  for (const d of due) {
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify({ title: 'Tu momento IRB', body: `${d.name.split(' ')[0]}, cinco minutos bastan para hoy.`, url: '/' }), { TTL: 3600 });
      await sql`update push_subscriptions set last_sent_day = ${d.today} where endpoint = ${d.endpoint}`;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sql`delete from push_subscriptions where endpoint = ${d.endpoint}`;
      else log.warn({ code }, 'push falló');
    }
  }
}
const reminderTimer = setInterval(() => void reminders().catch((e) => log.error(e)), 60_000);

for (const s of ['SIGTERM', 'SIGINT'] as const)
  process.on(s, async () => {
    clearInterval(timer);
    clearInterval(reminderTimer);
    await worker.close();
    await queue.close();
    await Promise.all([sql.end(), listener.end(), redis.quit()]);
    process.exit(0);
  });
