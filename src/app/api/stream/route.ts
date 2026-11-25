import { randomUUID } from 'node:crypto';
import { circleFor, circleRanking, ensureHub, hub, leavePresence, presenceCount, touchPresence } from '@/server/realtime';
import { subject } from '@/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE: un stream por pestaña.
 *   event: stats     XP, nivel, días, logros (cuando el worker procesa un evento de esta persona)
 *   event: presence  personas practicando esta clase ahora (?practice=<lessonId>)
 *   event: circle    ranking del círculo semanal (?circle=1, solo con opt-in)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const practice = Number(url.searchParams.get('practice')) || null;
  const wantCircle = url.searchParams.get('circle') === '1';
  const sub = await subject();
  await ensureHub();
  const enc = new TextEncoder();
  const conn = randomUUID();
  const cleanup: (() => void)[] = [];

  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (event: string, data: unknown) => {
        try {
          ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`));
        } catch {}
      };
      send('hello', { at: Date.now() });

      if (sub) {
        const onStats = (p: string) => send('stats', p);
        hub.on(`s:${sub}`, onStats);
        cleanup.push(() => hub.off(`s:${sub}`, onStats));
        if (sub.startsWith('u:')) {
          // UI Sinapsis: aviso de notificación nueva (el panel vuelve a pedir la lista)
          const onNotif = () => send('notification', { at: Date.now() });
          hub.on(`n:${sub.slice(2)}`, onNotif);
          cleanup.push(() => hub.off(`n:${sub.slice(2)}`, onNotif));
        }
      }

      if (practice) {
        let last = -1;
        const tick = async () => {
          await touchPresence(practice, conn);
          const n = await presenceCount(practice);
          if (n !== last) send('presence', { n }), (last = n);
        };
        await tick();
        const t = setInterval(() => void tick().catch(() => {}), 15_000);
        cleanup.push(() => clearInterval(t), () => void leavePresence(practice, conn));
      }

      if (wantCircle && sub?.startsWith('u:')) {
        const c = await circleFor(sub.slice(2));
        if (c) {
          const push = async () => send('circle', { id: c.id, name: c.name, rows: await circleRanking(c.id, sub.slice(2)) });
          await push();
          const onCircle = () => void push();
          hub.on(`c:${c.id}`, onCircle);
          cleanup.push(() => hub.off(`c:${c.id}`, onCircle));
        }
      }

      const ping = setInterval(() => {
        try {
          ctrl.enqueue(enc.encode(': ping\n\n'));
        } catch {}
      }, 20_000);
      cleanup.push(() => clearInterval(ping));
      req.signal.addEventListener('abort', () => {
        cleanup.forEach((f) => f());
        try {
          ctrl.close();
        } catch {}
      });
    },
    cancel() {
      cleanup.forEach((f) => f());
    },
  });

  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' } });
}
