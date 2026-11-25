'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from '@/db';
import { emit } from './events';
import { rateLimit, redis } from './redis';
import { createSession, currentUser, endSession, subject } from './session';

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/** Completar o desmarcar una clase. El XP lo decide el worker; la interfaz ya cambió de forma optimista. */
export async function setLessonDone(lessonId: number, done: boolean): Promise<ActionResult> {
  const sub = await subject();
  if (!sub) return { ok: false, error: 'Necesitas una sesión para guardar tu avance.' };
  if (!(await rateLimit(`done:${sub}`, 30, 60))) return { ok: false, error: 'Vas muy rápido. Intenta en un momento.' };
  const [l] = await sql<{ course_id: number; media_type: string; duration_s: number; is_free: boolean }[]>`select course_id, media_type, duration_s, is_free from lessons where id = ${lessonId}`;
  if (!l) return { ok: false, error: 'La clase no existe.' };
  if (sub.startsWith('a:') && !l.is_free) return { ok: false, error: 'Crea tu cuenta para guardar esta clase.' };
  await sql.begin(async (tx) => {
    let watched = Number((await redis.hget(`pp:${sub}:${lessonId}`, 'w')) ?? 0);
    if (sub.startsWith('u:')) {
      const [r] = await tx<{ watched_s: number }[]>`
        insert into lesson_progress (user_id, lesson_id, course_id, percent, completed_at, updated_at)
        values (${sub.slice(2)}, ${lessonId}, ${l.course_id}, ${done ? 100 : 0}, case when ${done} then now() end, now())
        on conflict (user_id, lesson_id) do update set completed_at = excluded.completed_at, percent = case when ${done} then 100 else lesson_progress.percent end, updated_at = now()
        returning watched_s`;
      watched = r?.watched_s ?? watched;
    }
    if (done)
      await emit(tx, sub, 'lesson.completed', { lessonId, courseId: l.course_id, mediaType: l.media_type, duration: l.duration_s, watched }, `${sub}:done-ev:${lessonId}:${Date.now()}`);
  });
  return { ok: true };
}

const NoteIn = z.object({ lessonId: z.number().int().positive(), positionS: z.number().int().min(0).max(36000), text: z.string().trim().min(1).max(4000) });

export async function addNote(input: z.infer<typeof NoteIn>): Promise<ActionResult<{ id: number; createdAt: string }>> {
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Tus notas se guardan en este dispositivo hasta que entres.' };
  const v = NoteIn.safeParse(input);
  if (!v.success) return { ok: false, error: 'La nota está vacía o es muy larga.' };
  if (!(await rateLimit(`note:${u.id}`, 20, 60))) return { ok: false, error: 'Espera un momento antes de guardar otra nota.' };
  const row = await sql.begin(async (tx) => {
    const [n] = await tx<{ id: number; created_at: Date }[]>`insert into notes (user_id, lesson_id, position_s, text) values (${u.id}, ${v.data.lessonId}, ${v.data.positionS}, ${v.data.text}) returning id, created_at`;
    await emit(tx, `u:${u.id}`, 'note.created', { noteId: n!.id, lessonId: v.data.lessonId }, `u:${u.id}:note:${n!.id}`);
    return n!;
  });
  return { ok: true, data: { id: row.id, createdAt: row.created_at.toISOString() } };
}

export async function deleteNote(id: number): Promise<ActionResult> {
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Sin sesión.' };
  await sql`delete from notes where id = ${id} and user_id = ${u.id}`;
  return { ok: true };
}

export async function track(name: string, props: Record<string, unknown> = {}) {
  const sub = await subject();
  if (!sub || !/^[a-z_]{3,40}$/.test(name)) return;
  if (!(await rateLimit(`trk:${sub}`, 60, 60))) return;
  await sql.begin((tx) => emit(tx, sub, name, props, `${sub}:${name}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`));
}

const Prefs = z.object({ dailyGoalMin: z.union([z.literal(5), z.literal(10), z.literal(20)]).optional(), circlesOptIn: z.boolean().optional(), soundOn: z.boolean().optional() });

export async function updatePrefs(input: z.infer<typeof Prefs>): Promise<ActionResult> {
  const u = await currentUser();
  if (!u) return { ok: false, error: 'Sin sesión.' };
  const v = Prefs.safeParse(input);
  if (!v.success) return { ok: false, error: 'Valor no válido.' };
  await sql.begin(async (tx) => {
    await tx`update users set daily_goal_min = coalesce(${v.data.dailyGoalMin ?? null}, daily_goal_min), circles_opt_in = coalesce(${v.data.circlesOptIn ?? null}, circles_opt_in), sound_on = coalesce(${v.data.soundOn ?? null}, sound_on) where id = ${u.id}`;
    if (v.data.circlesOptIn) await emit(tx, `u:${u.id}`, 'circles.joined', {}, `u:${u.id}:circle:${Date.now()}`);
  });
  revalidateTag(`user:${u.id}`);
  return { ok: true };
}

export async function signInAsTest(form: FormData) {
  const email = String(form.get('email') ?? '');
  const [u] = await sql<{ id: string }[]>`select id from users where email = ${email} and is_test`;
  if (!u) redirect('/entrar?error=1');
  await createSession(u.id);
  redirect(String(form.get('next') || '/'));
}

export async function signOut() {
  await endSession();
  redirect('/entrar');
}
