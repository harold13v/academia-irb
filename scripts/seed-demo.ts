/**
 * Datos de DEMO 100 % ficticios: 30 alumnas inventadas (@demo.test), 4 cursos de muestra, la práctica Fuegos,
 * 45 días de historia, comentarios y notificaciones. La historia entra como EVENTOS al outbox y se procesa aquí mismo
 * con el motor del worker (XP, días, metas, logros y círculos por el mismo camino que en producción).
 *
 *   npm run db:seed:demo            (borra y recrea TODO el contenido de la base indicada en DATABASE_URL)
 *
 * Protección: se niega a correr si la base tiene cursos importados de WordPress (wp_course_id) o usuarias reales.
 */
import Redis from 'ioredis';
import postgres from 'postgres';
import { processEvent } from '../src/worker/engine';

const sql = postgres(process.env.DATABASE_URL!, { max: 4 });
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

const RULES = [
  ['media_minute', 2, 'Cada minuto reproducido de video o audio (verificado)'],
  ['lesson_complete', 10, 'Completar una clase'],
  ['reading_complete', 6, 'Completar una lectura'],
  ['note', 2, 'Guardar una nota (máximo 5 al día)'],
  ['daily_goal', 15, 'Cumplir la meta diaria'],
  ['course_complete', 100, 'Completar un curso'],
] as const;
const LEVELS: [number, string, number, string | null][] = [
  [1, 'Inicio', 0, null], [2, 'Presencia', 100, null], [3, 'Raíz', 300, null], [4, 'Semilla', 600, null], [5, 'Brote', 1000, 'Meditación bonus'],
  [6, 'Tallo', 1500, null], [7, 'Flor', 2200, null], [8, 'Fruto', 3000, 'Clase en vivo grabada'], [9, 'Árbol', 4000, null], [10, 'Bosque', 5500, null],
];
const ACHIEVEMENTS = [
  ['primer-dia', 'Primer día', 'Practicaste por primera vez.', 'days_practiced', 1, 10],
  ['siete-dias', 'Siete días', 'Siete días practicados.', 'days_practiced', 7, 30],
  ['treinta-dias', 'Treinta días', 'Treinta días practicados.', 'days_practiced', 30, 100],
  ['primera-clase', 'Primera clase', 'Completaste tu primera clase.', 'lessons_completed', 1, 10],
  ['diez-clases', 'Diez clases', 'Diez clases completadas.', 'lessons_completed', 10, 30],
  ['primera-nota', 'Primera nota', 'Escribiste lo que surgió en una práctica.', 'notes', 1, 5],
  ['meta-cinco', 'Constancia', 'Cumpliste tu meta diaria cinco días.', 'goal_days', 5, 30],
  ['primer-curso', 'Primer curso', 'Completaste un curso entero.', 'course_completed', 1, 50],
] as const;

type L = { title: string; media: 'vimeo' | 'texto' | 'youtube'; min: number; body?: string };
const P = (t: string) => `<p>${t}</p>`;
const COURSES: { slug: string; title: string; subtitle: string; modules: { title: string; lessons: L[] }[] }[] = [
  {
    slug: 'respiracion-consciente', title: 'Respiración consciente', subtitle: 'Cuatro semanas para volver al cuerpo',
    modules: [
      { title: 'Primeros pasos', lessons: [{ title: 'Bienvenida', media: 'vimeo', min: 6 }, { title: 'Cómo sentarte', media: 'vimeo', min: 9 }, { title: 'Guía de lectura', media: 'texto', min: 4, body: P('Lee esta guía antes de la primera práctica. Busca un lugar tranquilo y una postura cómoda.') }] },
      { title: 'Práctica diaria', lessons: [{ title: 'Respiración 4-7-8', media: 'vimeo', min: 12 }, { title: 'Exhalar la prisa', media: 'vimeo', min: 15 }, { title: 'Cierre de la semana', media: 'vimeo', min: 10 }] },
      { title: 'Integración', lessons: [{ title: 'Respirar en el trabajo', media: 'vimeo', min: 8 }, { title: 'Diario de práctica', media: 'texto', min: 5, body: P('Anota cada noche tres sensaciones del día.') }] },
    ],
  },
  {
    slug: 'meditacion-de-luz-demo', title: 'Meditación de luz (demo)', subtitle: 'Programa de muestra en tres módulos',
    modules: [
      { title: 'Módulo 1 · Silencio', lessons: [{ title: 'Parte 1', media: 'vimeo', min: 9 }, { title: 'Parte 2', media: 'vimeo', min: 11 }, { title: 'Parte 3', media: 'vimeo', min: 7 }] },
      { title: 'Módulo 2 · Presencia', lessons: [{ title: 'Parte 4', media: 'vimeo', min: 14 }, { title: 'Parte 5', media: 'vimeo', min: 13 }, { title: 'Lectura de apoyo', media: 'texto', min: 6, body: P('Un texto breve para acompañar el módulo.') }] },
      { title: 'Módulo 3 · Expansión', lessons: [{ title: 'Parte 6', media: 'vimeo', min: 16 }, { title: 'Parte 7', media: 'vimeo', min: 18 }, { title: 'Mensaje de cierre', media: 'vimeo', min: 5 }] },
    ],
  },
  {
    slug: 'abundancia-cotidiana', title: 'Abundancia cotidiana', subtitle: 'Hábitos pequeños, cambios grandes',
    modules: [{ title: 'Contenido', lessons: [{ title: 'Introducción', media: 'vimeo', min: 10 }, { title: 'Creencias', media: 'vimeo', min: 14 }, { title: 'Ejercicio escrito', media: 'texto', min: 6, body: P('Escribe tres creencias que quieras revisar.') }, { title: 'Gratitud práctica', media: 'vimeo', min: 12 }] }],
  },
  {
    slug: 'pausas-activas', title: 'Pausas activas', subtitle: 'Cinco minutos que cambian el día',
    modules: [{ title: 'Contenido', lessons: [{ title: 'Estiramiento suave', media: 'vimeo', min: 5 }, { title: 'Pausa de mediodía', media: 'vimeo', min: 6 }, { title: 'Video público de ejemplo', media: 'youtube', min: 4 }] }],
  },
];

const NAMES = ['Ana Demo', 'Bea Prueba', 'Carla Ejemplo', 'Dana Ficticia', 'Elsa Muestra', 'Flor Demo', 'Gina Prueba', 'Hilda Ejemplo', 'Iris Ficticia', 'Julia Muestra', 'Karen Demo', 'Lía Prueba', 'Mara Ejemplo', 'Nora Ficticia', 'Olga Muestra', 'Paz Demo', 'Rita Prueba', 'Sara Ejemplo', 'Tina Ficticia', 'Úrsula Muestra', 'Vera Demo', 'Wendy Prueba', 'Xime Ejemplo', 'Yara Ficticia', 'Zoe Muestra', 'Alba Demo', 'Celia Prueba', 'Eva Ejemplo', 'Tomás Ficticio', 'Iván Muestra'];
const TZ = ['America/Bogota', 'America/Bogota', 'America/Mexico_City', 'America/Lima', 'Europe/Madrid', 'America/Argentina/Buenos_Aires'];
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function guard() {
  const [r] = await sql<{ wp: number; real: number }[]>`select (select count(*) from courses where wp_course_id is not null)::int wp, (select count(*) from users where not is_test)::int real`;
  if ((r!.wp || r!.real) && !process.argv.includes('--force')) {
    console.error(`La base tiene ${r!.wp} cursos importados y ${r!.real} usuarias reales. El seed de demo BORRA todo: no corre aquí (usa --force solo en una base local).`);
    process.exit(2);
  }
}

async function main() {
  await guard();
  await sql`truncate events, xp_ledger, practice_days, subject_stats, user_achievements, circle_members, circles, comment_likes, comment_favorites, comments,
    notifications, push_subscriptions, streak_week_pauses, notes, lesson_progress, enrollments, lessons, modules, courses, users, levels, achievements, gamification_rules restart identity cascade`;
  for (const k of await redis.keys('circle:*')) await redis.del(k);
  for (const k of await redis.keys('c:*')) await redis.del(k); // caché de temarios e índice de búsqueda

  for (const [key, amount, label] of RULES) await sql`insert into gamification_rules (key, amount, label) values (${key}, ${amount}, ${label})`;
  for (const [level, name, threshold, unlock] of LEVELS) await sql`insert into levels (level, name, threshold, unlock_label) values (${level}, ${name}, ${threshold}, ${unlock})`;
  for (const [i, [key, title, description, type, gte, xp]] of ACHIEVEMENTS.entries())
    await sql`insert into achievements (key, title, description, rule, xp, position) values (${key}, ${title}, ${description}, ${sql.json({ type, gte })}, ${xp}, ${i})`;

  // Fuegos: práctica pública. El ID es el video público de Fuegos; el hash privado (si hace falta) va en FUEGOS_VIMEO_HASH.
  const [fu] = await sql<{ id: number }[]>`insert into courses (slug, title, subtitle, description, kind, position) values ('fuegos', 'Fuegos', 'Práctica guiada de purificación', '', 'practice', 0) returning id`;
  const [fm] = await sql<{ id: number }[]>`insert into modules (course_id, position, title) values (${fu!.id}, 0, 'Práctica') returning id`;
  await sql`insert into lessons ${sql({
    module_id: fm!.id, course_id: fu!.id, position: 0, slug: 'fuegos', title: 'Fuegos', subtitle: 'Práctica guiada de purificación', media_type: 'vimeo',
    vimeo_id: '760167839', vimeo_hash: process.env.FUEGOS_VIMEO_HASH || null, duration_s: 1630, is_free: true, playable_in_staging: true, autoplay_next: false,
    body_html: '<h2>¿Qué vas a vivir en esta práctica?</h2><p>Una práctica guiada de 27 minutos para soltar lo que ya no te pertenece.</p>',
    prep: sql.json(['Busca un lugar donde nadie te interrumpa.', 'Usa audífonos si puedes.', 'Activa el modo No molestar.']),
  })}`;

  const lessonsBy = new Map<number, { id: number; duration_s: number; media_type: string }[]>();
  for (const [ci, c] of COURSES.entries()) {
    const [co] = await sql<{ id: number }[]>`insert into courses (slug, title, subtitle, description, kind, position) values (${c.slug}, ${c.title}, ${c.subtitle}, '', 'course', ${ci + 1}) returning id`;
    let pos = 0;
    const used = new Set<string>();
    for (const [mi, m] of c.modules.entries()) {
      const [mo] = await sql<{ id: number }[]>`insert into modules (course_id, position, title) values (${co!.id}, ${mi}, ${m.title}) returning id`;
      for (const l of m.lessons) {
        let slug = slugify(l.title);
        while (used.has(slug)) slug += '-2';
        used.add(slug);
        await sql`insert into lessons ${sql({
          module_id: mo!.id, course_id: co!.id, position: pos++, slug, title: l.title, subtitle: '', media_type: l.media,
          // IDs de Vimeo inventados: en dev se ve el póster con el aviso "Video no autorizado en este dominio"
          vimeo_id: l.media === 'vimeo' ? String(100000000 + ci * 1000 + pos) : null,
          media_url: l.media === 'youtube' ? 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' : null,
          duration_s: l.min * 60, body_html: l.body ?? P(`Texto de apoyo de «${l.title}». Contenido de demostración.`), prep: sql.json([]),
          is_free: false, playable_in_staging: false, autoplay_next: !/medita|cierre/i.test(l.title),
        })}`;
      }
    }
    lessonsBy.set(co!.id, await sql`select id, duration_s, media_type from lessons where course_id = ${co!.id} order by position`);
  }
  const courses = [...lessonsBy.keys()];

  let events = 0;
  const users: string[] = [];
  for (const [i, name] of NAMES.entries()) {
    const consistency = i === 0 ? 0.92 : 0.25 + rnd() * 0.6;
    const [u] = await sql<{ id: string }[]>`insert into users (email, name, timezone, daily_goal_min, circles_opt_in, is_test, staff_badge, created_at)
      values (${`alumna${String(i + 1).padStart(2, '0')}@demo.test`}, ${name}, ${i === 0 ? 'America/Bogota' : pick(TZ)}, ${pick([5, 10, 10, 20])}, ${i < 22}, true, ${i === 1 ? 'Equipo IRB' : null}, now() - interval '60 days') returning id`;
    users.push(u!.id);
    const sub = `u:${u!.id}`;
    const mine = [courses[i % 3]!, courses[(i + 1) % 3]!, ...(rnd() < 0.5 ? [courses[3]!] : [])];
    for (const c of mine) await sql`insert into enrollments (user_id, course_id, origin) values (${u!.id}, ${c}, 'manual') on conflict do nothing`;
    const cursor = new Map(mine.map((c) => [c, 0]));
    for (let back = 45; back >= 0; back--) {
      if (rnd() > consistency) continue;
      const ts = new Date(Date.now() - back * 86_400_000);
      ts.setUTCHours(11 + Math.floor(rnd() * 12), Math.floor(rnd() * 60));
      const c = rnd() < 0.75 ? mine[0]! : pick(mine);
      const list = lessonsBy.get(c)!;
      const l = list[cursor.get(c)!];
      if (!l) continue;
      const full = rnd() < 0.82;
      const watched = Math.round(l.duration_s * (full ? 1 : 0.3 + rnd() * 0.5));
      await sql`insert into lesson_progress (user_id, lesson_id, course_id, position_s, watched_s, percent, completed_at, updated_at)
        values (${u!.id}, ${l.id}, ${c}, ${full ? 0 : watched}, ${watched}, ${full ? 100 : Math.round((watched / l.duration_s) * 100)}, ${full ? ts.toISOString() : null}, ${ts.toISOString()})
        on conflict (user_id, lesson_id) do update set watched_s = excluded.watched_s, percent = excluded.percent, completed_at = excluded.completed_at, updated_at = excluded.updated_at`;
      const ev = (n: string, props: Record<string, unknown>, key: string, at: Date) =>
        sql`insert into events (subject, name, props, idempotency_key, ts) values (${sub}, ${n}, ${sql.json(props as never)}, ${key}, ${at.toISOString()})`.then(() => events++);
      if (l.media_type !== 'texto') await ev('media.progress', { lessonId: l.id, courseId: c, verified: watched, watched, backfill: true }, `${sub}:seed:${l.id}:${back}`, ts);
      if (i < 22 && back === 45) await ev('circles.joined', {}, `${sub}:circle`, ts);
      if (full) {
        await ev('lesson.completed', { lessonId: l.id, courseId: c, mediaType: l.media_type, duration: l.duration_s, watched }, `${sub}:seed-done:${l.id}`, new Date(ts.getTime() + watched * 1000));
        cursor.set(c, cursor.get(c)! + 1);
      }
      if (rnd() < 0.2) {
        const [n] = await sql<{ id: number }[]>`insert into notes (user_id, lesson_id, position_s, text, created_at) values (${u!.id}, ${l.id}, ${Math.round(watched * rnd())}, ${pick(['Sentí calma en el pecho.', 'Soltar la prisa.', 'Volver a esta parte mañana.', 'Respirar antes de responder.'])}, ${ts.toISOString()}) returning id`;
        await ev('note.created', { noteId: n!.id, lessonId: l.id }, `${sub}:note:${n!.id}`, ts);
      }
    }
  }

  // procesa el outbox con el mismo motor del worker (en orden de fecha)
  const pending = await sql<{ id: number; subject: string; name: string; props: Record<string, unknown>; ts: Date }[]>`
    select id, subject, name, props, ts from events where processed_at is null order by ts, id`;
  for (const e of pending)
    await sql.begin(async (tx) => {
      await processEvent(tx as never, redis, { ...e, ts: new Date(e.ts) });
      await tx`update events set processed_at = now() where id = ${e.id}`;
    });

  // círculo de la semana en curso con las alumnas que aceptaron (el worker lo hace al practicar; aquí se deja listo)
  const [{ wk }] = (await sql<{ wk: string }[]>`select to_char(date_trunc('week', (now() at time zone 'America/Bogota'))::date, 'YYYY-MM-DD') wk`) as unknown as [{ wk: string }];
  const [circle] = await sql<{ id: number }[]>`insert into circles (week_start, name, size) values (${wk}, 'Círculo 1', 0) returning id`;
  await sql`insert into circle_members (circle_id, user_id, seconds)
    select ${circle!.id}, u.id, coalesce((select sum(d.seconds) from practice_days d where d.subject = 'u:' || u.id and d.day >= ${wk}::date), 0)::int
    from users u where u.circles_opt_in`;
  await sql`update circles set size = (select count(*) from circle_members where circle_id = ${circle!.id}) where id = ${circle!.id}`;

  // comentarios y notificaciones de muestra en la primera clase del primer curso
  const first = lessonsBy.get(courses[0]!)![0]!;
  const [c1] = await sql<{ id: number }[]>`insert into comments (lesson_id, user_id, kind, body, likes) values (${first.id}, ${users[3]!}, 'aporte', 'Me ayudó mucho respirar antes de empezar el día.', 4) returning id`;
  const [c2] = await sql<{ id: number }[]>`insert into comments (lesson_id, user_id, kind, body) values (${first.id}, ${users[0]!}, 'pregunta', '¿Se puede practicar acostada?') returning id`;
  await sql`insert into comments (lesson_id, user_id, parent_id, kind, body) values (${first.id}, ${users[1]!}, ${c2!.id}, 'aporte', 'Sí, con la espalda apoyada y las piernas relajadas.')`;
  await sql`insert into notifications (user_id, kind, title, body, href) values
    (${users[0]!}, 'comment', 'Respondieron tu pregunta', 'Bea Prueba respondió en «Bienvenida».', ${'/cursos/respiracion-consciente/bienvenida'}),
    (${users[0]!}, 'practice', 'Nueva práctica disponible', 'Fuegos ya está en tu biblioteca.', '/practicas/fuegos')`;
  void c1;

  const [s] = await sql`select (select count(*) from users)::int alumnas, (select count(*) from courses)::int cursos, (select count(*) from lessons)::int clases,
    (select count(*) from events)::int eventos, (select count(*) from xp_ledger)::int xp, (select count(*) from user_achievements)::int logros, (select count(*) from circles)::int circulos`;
  console.log('demo lista', s);
  await sql.end();
  redis.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  redis.disconnect();
  process.exit(1);
});
