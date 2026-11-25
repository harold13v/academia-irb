'use server';

import { z } from 'zod';
import { sql } from '@/db';
import { emit } from './events';
import { rateLimit } from './redis';
import { currentUser } from './session';
import { getComments, getNotifications, getWeeklyStreak, weekStartOf } from './social';

type R<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

export async function listComments(lessonId: number, filter: string, sort: string) {
  const u = await currentUser();
  return getComments(lessonId, u?.id ?? null, filter, sort);
}

const CommentIn = z.object({ lessonId: z.number().int().positive(), body: z.string().trim().min(2).max(3000), kind: z.enum(['aporte', 'pregunta']), parentId: z.number().int().positive().nullable() });

export async function postComment(input: z.infer<typeof CommentIn>): Promise<R<{ id: number }>> {
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Entra a tu cuenta para comentar.' };
  const v = CommentIn.safeParse(input);
  if (!v.success) return { ok: false, error: 'El comentario está vacío o es muy largo.' };
  if (!(await rateLimit(`cmt:${u.id}`, 6, 60))) return { ok: false, error: 'Espera un momento antes de publicar otra vez.' };
  const id = await sql.begin(async (tx) => {
    const [c] = await tx<{ id: number }[]>`insert into comments (lesson_id, user_id, parent_id, kind, body) values (${v.data.lessonId}, ${u.id}, ${v.data.parentId}, ${v.data.kind}, ${v.data.body}) returning id`;
    await emit(tx, `u:${u.id}`, 'comment.created', { commentId: c!.id, lessonId: v.data.lessonId, parentId: v.data.parentId }, `u:${u.id}:comment:${c!.id}`);
    return c!.id;
  });
  return { ok: true, data: { id } };
}

export async function toggleCommentLike(commentId: number): Promise<R<{ liked: boolean }>> {
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Entra a tu cuenta para dar Me gusta.' };
  const liked = await sql.begin(async (tx) => {
    const del = await tx`delete from comment_likes where comment_id = ${commentId} and user_id = ${u.id} returning 1`;
    if (del.length) {
      await tx`update comments set likes = greatest(0, likes - 1) where id = ${commentId}`;
      return false;
    }
    await tx`insert into comment_likes (comment_id, user_id) values (${commentId}, ${u.id}) on conflict do nothing`;
    await tx`update comments set likes = likes + 1 where id = ${commentId}`;
    return true;
  });
  return { ok: true, data: { liked } };
}

export async function toggleCommentFav(commentId: number): Promise<R<{ fav: boolean }>> {
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Entra a tu cuenta.' };
  const del = await sql`delete from comment_favorites where comment_id = ${commentId} and user_id = ${u.id} returning 1`;
  if (!del.length) await sql`insert into comment_favorites (comment_id, user_id) values (${commentId}, ${u.id}) on conflict do nothing`;
  return { ok: true, data: { fav: !del.length } };
}

export async function listNotifications(filter: string) {
  const u = await currentUser();
  if (!u) return { rows: [], unread: 0 };
  return getNotifications(u.id, filter);
}

export async function markNotificationsRead(id?: number): Promise<R> {
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Sin sesión.' };
  if (id) await sql`update notifications set read_at = now() where id = ${id} and user_id = ${u.id} and read_at is null`;
  else await sql`update notifications set read_at = now() where user_id = ${u.id} and read_at is null`;
  return { ok: true };
}

const UiPrefs = z.object({ hideStreak: z.boolean().optional(), reminderHour: z.number().int().min(0).max(23).nullable().optional() });

export async function setUiPrefs(input: z.infer<typeof UiPrefs>): Promise<R> {
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Sin sesión.' };
  const v = UiPrefs.safeParse(input);
  if (!v.success) return { ok: false, error: 'Valor no válido.' };
  if (v.data.hideStreak !== undefined) await sql`update users set hide_streak = ${v.data.hideStreak} where id = ${u.id}`;
  if (v.data.reminderHour !== undefined) await sql`update users set reminder_hour = ${v.data.reminderHour} where id = ${u.id}`;
  return { ok: true };
}

/** "Pausar mi racha": la semana en curso no corta la racha. Una pausa por mes. */
export async function pauseThisWeek(): Promise<R> {
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Sin sesión.' };
  const s = await getWeeklyStreak(`u:${u.id}`, u.timezone);
  if (s.pausedThisWeek) return { ok: true };
  if (s.pausesLeftMonth <= 0) return { ok: false, error: 'Ya usaste la pausa de este mes. Una práctica corta mantiene tu camino.' };
  const today = new Date().toLocaleDateString('en-CA', { timeZone: u.timezone });
  await sql`insert into streak_week_pauses (subject, week_start) values (${`u:${u.id}`}, ${weekStartOf(today)}) on conflict do nothing`;
  return { ok: true };
}

export async function weeklyStreak() {
  const u = await currentUser();
  if (!u) return null;
  return getWeeklyStreak(`u:${u.id}`, u.timezone, u.hideStreak);
}
