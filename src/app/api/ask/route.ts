import { z } from 'zod';
import { sql } from '@/db';
import { rateLimit } from '@/server/redis';
import { subject } from '@/server/session';

const In = z.object({ lessonId: z.number().int().positive(), question: z.string().trim().min(3).max(600) });

const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * "Pregúntale a IRB": acotado a la clase. Con ANTHROPIC_API_KEY responde Claude usando solo el material de la clase;
 * sin clave, devuelve los fragmentos del resumen que mejor responden (modo extractivo, se indica en la respuesta).
 */
export async function POST(req: Request) {
  const sub = await subject();
  if (!sub) return Response.json({ error: 'sin_identidad' }, { status: 401 });
  if (!(await rateLimit(`ask:${sub}`, 10, 300))) return Response.json({ answer: 'Hiciste muchas preguntas seguidas. Respira un momento y vuelve a intentarlo.', mode: 'limit' });
  const v = In.safeParse(await req.json().catch(() => null));
  if (!v.success) return Response.json({ error: 'datos_invalidos' }, { status: 400 });
  const [l] = await sql<{ title: string; subtitle: string; body_html: string; course: string }[]>`
    select l.title, l.subtitle, l.body_html, c.title course from lessons l join courses c on c.id = l.course_id where l.id = ${v.data.lessonId}`;
  if (!l) return Response.json({ error: 'clase_no_existe' }, { status: 404 });
  const material = `${l.title}. ${l.subtitle}. ${strip(l.body_html)}`.slice(0, 12000);

  if (process.env.ANTHROPIC_API_KEY) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: `Eres "Pregúntale a IRB", acompañas a alumnas de la Escuela IRB de Ximena Duque Valencia. Responde en español, cálido y breve, SOLO con base en el material de esta práctica. Si la pregunta no se relaciona con la práctica, di amablemente: "Solo puedo responder sobre esta práctica." No des consejos médicos.\n\nMaterial de la práctica «${l.title}» (${l.course}):\n${material}`,
        messages: [{ role: 'user', content: v.data.question }],
      }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { content?: { text?: string }[] } | null;
    const text = j?.content?.map((c) => c.text ?? '').join('').trim();
    if (text) return Response.json({ answer: text, mode: 'ia' });
  }

  const terms = fold(v.data.question).split(/\W+/).filter((t) => t.length > 3);
  const sentences = material.split(/(?<=[.!?])\s+/).filter((s) => s.length > 30);
  const scored = sentences.map((s) => ({ s, n: terms.reduce((a, t) => a + (fold(s).includes(t) ? 1 : 0), 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3);
  const answer = scored.length
    ? scored.map((x) => x.s).join(' ')
    : 'Solo puedo responder sobre esta práctica, y en su material no encontré algo sobre eso. Prueba con otras palabras o pregúntalo en Comentarios.';
  return Response.json({ answer, mode: 'extractivo' });
}
