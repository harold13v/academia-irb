import 'server-only';
import { eq } from 'drizzle-orm';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { db, schema } from '@/db';

const SESSION = 'irb_session';
const ANON = 'irb_anon';
const key = () => new TextEncoder().encode(process.env.APP_SECRET!);

export async function createSession(userId: string) {
  const token = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('30d').sign(key());
  (await cookies()).set(SESSION, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
}

export async function endSession() {
  (await cookies()).delete(SESSION);
}

export const sessionUserId = cache(async () => {
  const t = (await cookies()).get(SESSION)?.value;
  if (!t) return null;
  try {
    return (await jwtVerify(t, key(), { algorithms: ['HS256'] })).payload.sub ?? null;
  } catch {
    return null;
  }
});

export const currentUser = cache(async () => {
  const id = await sessionUserId();
  return id ? ((await db.query.users.findFirst({ where: eq(schema.users.id, id) })) ?? null) : null;
});

/** Identidad para eventos y XP: u:<uuid> con sesión, a:<id anónimo> en prácticas sin login. */
export async function subject(): Promise<string | null> {
  const uid = await sessionUserId();
  if (uid) return `u:${uid}`;
  const a = (await cookies()).get(ANON)?.value;
  return a && /^[a-z0-9]{16,40}$/.test(a) ? `a:${a}` : null;
}

export { ANON };
