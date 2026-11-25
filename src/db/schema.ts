import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const ts = (n: string) => timestamp(n, { withTimezone: true });

/* ───────────────────────────── personas ───────────────────────────── */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  wpUserId: integer('wp_user_id').unique(),
  passwordHash: text('password_hash'),
  /** phpass | wp-bcrypt | argon2id: se rehashea a argon2id en el primer login (fase 2) */
  passwordAlgo: text('password_algo'),
  timezone: text('timezone').notNull().default('America/Bogota'),
  /** 5, 10 o 20 minutos, lo elige la alumna */
  dailyGoalMin: smallint('daily_goal_min').notNull().default(10),
  circlesOptIn: boolean('circles_opt_in').notNull().default(false),
  soundOn: boolean('sound_on').notNull().default(false),
  /** UI Sinapsis (migración aditiva 0001) */
  hideStreak: boolean('hide_streak').notNull().default(false),
  reminderHour: smallint('reminder_hour'),
  staffBadge: text('staff_badge'),
  isTest: boolean('is_test').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/* ───────────────────────────── catálogo ───────────────────────────── */

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  subtitle: text('subtitle').notNull().default(''),
  description: text('description').notNull().default(''),
  cover: text('cover'),
  wpCourseId: integer('wp_course_id').unique(),
  /** course | practice (práctica gratuita pública, sin login) */
  kind: text('kind').notNull().default('course'),
  status: text('status').notNull().default('published'),
  position: integer('position').notNull().default(0),
});

export const modules = pgTable(
  'modules',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    title: text('title').notNull(),
  },
  // temario: módulos de un curso en orden
  (t) => [index('modules_course_pos').on(t.courseId, t.position)],
);

export const lessons = pgTable(
  'lessons',
  {
    id: serial('id').primaryKey(),
    moduleId: integer('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
    courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    /** orden global dentro del curso: siguiente / anterior sin recorrer módulos */
    position: integer('position').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    /** vimeo | soundcloud | youtube | spotify | gdoc | texto */
    mediaType: text('media_type').notNull(),
    mediaUrl: text('media_url'),
    vimeoId: text('vimeo_id'),
    /** nunca sale al cliente sin acceso: lo entrega el servidor */
    vimeoHash: text('vimeo_hash'),
    poster: text('poster'),
    durationS: integer('duration_s').notNull().default(0),
    bodyHtml: text('body_html').notNull().default(''),
    /** checklist "Antes de empezar" (texto por línea) */
    prep: jsonb('prep').$type<string[]>().notNull().default([]),
    isFree: boolean('is_free').notNull().default(false),
    /** solo se reproduce en staging si el dominio está autorizado en Vimeo */
    playableInStaging: boolean('playable_in_staging').notNull().default(false),
    /** false en meditaciones guiadas: el fin de clase no cuenta hacia la siguiente (migración aditiva 0001) */
    autoplayNext: boolean('autoplay_next').notNull().default(true),
    wpLessonId: integer('wp_lesson_id'),
  },
  (t) => [
    // URL /cursos/[curso]/[clase]
    uniqueIndex('lessons_course_slug').on(t.courseId, t.slug),
    // temario y navegación siguiente/anterior
    index('lessons_course_pos').on(t.courseId, t.position),
  ],
);

export const enrollments = pgTable(
  'enrollments',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    origin: text('origin').notNull(), // wp_import | compra | manual
    grantedAt: ts('granted_at').notNull().defaultNow(),
    expiresAt: ts('expires_at'),
    externalRef: text('external_ref'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId] })],
);

/* ───────────────────────────── progreso ───────────────────────────── */

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    lessonId: integer('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    courseId: integer('course_id').notNull(),
    positionS: integer('position_s').notNull().default(0),
    /** segundos reproducidos verificados en el servidor (antitrampa) */
    watchedS: integer('watched_s').notNull().default(0),
    percent: smallint('percent').notNull().default(0),
    completedAt: ts('completed_at'),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.lessonId] }),
    // "Mis cursos": progreso de una alumna por curso, y "Continuar donde quedaste" (último updated_at)
    index('lp_user_course').on(t.userId, t.courseId),
    index('lp_user_updated').on(t.userId, t.updatedAt.desc()),
  ],
);

export const notes = pgTable(
  'notes',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    lessonId: integer('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    positionS: integer('position_s').notNull().default(0),
    text: text('text').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  // pestaña Notas: notas de una alumna en una clase, recientes primero
  (t) => [index('notes_user_lesson').on(t.userId, t.lessonId, t.createdAt.desc())],
);

/* ───────────────────────── eventos (outbox) ───────────────────────── */

/**
 * Cada acción escribe aquí en la misma transacción que su efecto. Un trigger hace NOTIFY 'outbox';
 * el worker procesa en orden y marca processed_at. idempotency_key evita duplicar un mismo evento.
 */
export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** u:<uuid> o a:<anon_id> (práctica sin login). El email nunca entra aquí. */
    subject: text('subject').notNull(),
    name: text('name').notNull(),
    props: jsonb('props').$type<Record<string, unknown>>().notNull().default({}),
    idempotencyKey: text('idempotency_key').notNull(),
    ts: ts('ts').notNull().defaultNow(),
    processedAt: ts('processed_at'),
    error: text('error'),
  },
  (t) => [
    uniqueIndex('events_idem').on(t.idempotencyKey),
    // el worker solo barre lo pendiente: índice parcial diminuto aunque la tabla crezca a millones
    index('events_pending').on(t.id).where(sql`processed_at is null`),
    // analítica por nombre de evento en el tiempo (fuegos_play, fuegos_completado…)
    index('events_name_ts').on(t.name, t.ts),
  ],
);

/* ─────────────────────────── gamificación ─────────────────────────── */

/** Libro mayor de XP: solo se inserta. El total se deriva (vista materializada en subject_stats). */
export const xpLedger = pgTable(
  'xp_ledger',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    subject: text('subject').notNull(),
    source: text('source').notNull(), // regla aplicada: media_minute, lesson_complete, note, daily_goal, achievement…
    refId: text('ref_id'),
    amount: integer('amount').notNull(),
    ts: ts('ts').notNull().defaultNow(),
    idempotencyKey: text('idempotency_key').notNull(),
  },
  (t) => [
    uniqueIndex('xp_idem').on(t.idempotencyKey),
    // total y ranking semanal de una persona: suma por subject en un rango de fechas
    index('xp_subject_ts').on(t.subject, t.ts),
  ],
);

/** Cuánto vale cada acción. Editable sin deploy; el worker la lee con caché corta. */
export const gamificationRules = pgTable('gamification_rules', {
  key: text('key').primaryKey(),
  amount: integer('amount').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  label: text('label').notNull(),
});

/** Segundos practicados por día local de la alumna: base de días de práctica, meta diaria y círculos. */
export const practiceDays = pgTable(
  'practice_days',
  {
    subject: text('subject').notNull(),
    day: date('day').notNull(),
    seconds: integer('seconds').notNull().default(0),
    goalMet: boolean('goal_met').notNull().default(false),
    /** día cubierto por una pausa (no practicó, pero la racha sigue) */
    pause: boolean('pause').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.subject, t.day] })],
);

/** Estado materializado por el worker: lo que la interfaz lee en una sola fila. */
export const subjectStats = pgTable('subject_stats', {
  subject: text('subject').primaryKey(),
  xp: integer('xp').notNull().default(0),
  level: smallint('level').notNull().default(1),
  daysPracticed: integer('days_practiced').notNull().default(0),
  currentRun: integer('current_run').notNull().default(0),
  bestRun: integer('best_run').notNull().default(0),
  pausesUsedMonth: smallint('pauses_used_month').notNull().default(0),
  lastPracticeDay: date('last_practice_day'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const levels = pgTable('levels', {
  level: smallint('level').primaryKey(),
  name: text('name').notNull(),
  threshold: integer('threshold').notNull(),
  /** algunos niveles abren contenido extra */
  unlockLessonId: integer('unlock_lesson_id').references(() => lessons.id),
  unlockLabel: text('unlock_label'),
});

export const achievements = pgTable('achievements', {
  key: text('key').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  /** { type: 'days_practiced' | 'lessons_completed' | 'notes' | 'course_completed' | 'goal_days', gte: n } */
  rule: jsonb('rule').$type<{ type: string; gte: number }>().notNull(),
  xp: integer('xp').notNull().default(0),
  position: smallint('position').notNull().default(0),
});

export const userAchievements = pgTable(
  'user_achievements',
  {
    subject: text('subject').notNull(),
    key: text('key').notNull().references(() => achievements.key),
    earnedAt: ts('earned_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.subject, t.key] })],
);

/** Círculos semanales opt-in de ~30 personas. El ranking en vivo vive en Redis (sorted set por círculo). */
export const circles = pgTable(
  'circles',
  {
    id: serial('id').primaryKey(),
    weekStart: date('week_start').notNull(),
    name: text('name').notNull(),
    size: smallint('size').notNull().default(0),
  },
  // asignar al primer círculo con cupo de la semana
  (t) => [index('circles_week').on(t.weekStart, t.size)],
);

export const circleMembers = pgTable(
  'circle_members',
  {
    circleId: integer('circle_id').notNull().references(() => circles.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    seconds: integer('seconds').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.circleId, t.userId] }), index('cm_user').on(t.userId)],
);

/* ───────────── UI Sinapsis · migración aditiva 0001 (no toca tablas existentes) ───────────── */

/** Comentarios por clase: aportes y preguntas, con respuestas (parent_id). */
export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    lessonId: integer('lesson_id').notNull().references(() => lessons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    parentId: integer('parent_id'),
    kind: text('kind').notNull().default('aporte'), // aporte | pregunta
    body: text('body').notNull(),
    likes: integer('likes').notNull().default(0),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  // panel de comentarios de una clase (orden por votos o por fecha)
  (t) => [index('comments_lesson').on(t.lessonId, t.createdAt.desc()), index('comments_parent').on(t.parentId)],
);

export const commentLikes = pgTable(
  'comment_likes',
  {
    commentId: integer('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);

export const commentFavorites = pgTable(
  'comment_favorites',
  {
    commentId: integer('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);

/** Notificaciones de la alumna (respuestas, prácticas nuevas, círculos). Llegan por SSE. */
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // comment | practice | circle | system
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    href: text('href'),
    readAt: ts('read_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  // panel: no leídas primero, recientes
  (t) => [index('notif_user_created').on(t.userId, t.createdAt.desc())],
);

/** Push PWA para el recordatorio diario (máximo 1 al día). */
export const pushSubscriptions = pgTable('push_subscriptions', {
  endpoint: text('endpoint').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  lastSentDay: date('last_sent_day'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/** "Pausar mi racha": semana pausada a pedido de la alumna (racha semanal). */
export const streakWeekPauses = pgTable(
  'streak_week_pauses',
  {
    subject: text('subject').notNull(),
    weekStart: date('week_start').notNull(),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.subject, t.weekStart] })],
);

export type Lesson = typeof lessons.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type User = typeof users.$inferSelect;
