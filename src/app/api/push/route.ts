import { z } from 'zod';
import { sql } from '@/db';
import { currentUser } from '@/server/session';

const Sub = z.object({ endpoint: z.string().url().max(800), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });

/** Guarda la suscripción push del navegador para el recordatorio diario (máximo 1 al día, lo envía el worker). */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return Response.json({ error: 'sin_sesion' }, { status: 401 });
  const v = Sub.safeParse(await req.json().catch(() => null));
  if (!v.success) return Response.json({ error: 'datos_invalidos' }, { status: 400 });
  await sql`insert into push_subscriptions (endpoint, user_id, p256dh, auth) values (${v.data.endpoint}, ${u.id}, ${v.data.keys.p256dh}, ${v.data.keys.auth})
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`;
  return Response.json({ ok: true });
}
