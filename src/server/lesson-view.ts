import 'server-only';
import type { LessonData } from '@/components/lesson/context';
import type { OutlineView } from '@/components/player/types';
import { canAccess, getCourseProgress, getLesson, getNotes, getOutline } from './data';
import { currentUser } from './session';

/**
 * Todo lo que necesita una vista de clase, resuelto en el servidor.
 * El hash privado de Vimeo y el cuerpo de la clase solo viajan al navegador si hay acceso.
 */
export async function buildLessonView(courseSlug: string, lessonSlug: string | null, basePath: string) {
  const outline = await getOutline(courseSlug);
  if (!outline) return null;
  const flat = outline.modules.flatMap((m) => m.lessons);
  const ref = lessonSlug ? flat.find((l) => l.slug === lessonSlug) : flat[0];
  if (!ref) return null;
  const [lesson, user] = await Promise.all([getLesson(outline.id, ref.slug), currentUser()]);
  if (!lesson) return null;
  const access = await canAccess(user?.id ?? null, outline.id, lesson.isFree);
  const [progress, notes] = user ? await Promise.all([getCourseProgress(user.id, outline.id), access ? getNotes(user.id, lesson.id) : []]) : [{}, []];
  const i = flat.findIndex((l) => l.id === lesson.id);
  const nav = (l: (typeof flat)[number] | undefined) => (l ? { slug: l.slug, title: l.title } : null);

  const data: LessonData = {
    id: lesson.id,
    courseId: outline.id,
    courseSlug: outline.slug,
    courseTitle: outline.kind === 'practice' ? 'Prácticas' : outline.title,
    kind: outline.kind === 'practice' ? 'practice' : 'course',
    basePath,
    slug: lesson.slug,
    title: lesson.title,
    subtitle: lesson.subtitle,
    mediaType: lesson.mediaType,
    mediaUrl: access ? lesson.mediaUrl : null,
    vimeoId: lesson.vimeoId,
    vimeoHash: access ? lesson.vimeoHash : null,
    poster: lesson.poster,
    cover: outline.cover,
    durationS: lesson.durationS,
    bodyHtml: access ? lesson.bodyHtml : '',
    prep: lesson.prep,
    isFree: lesson.isFree,
    autoplayNext: lesson.autoplayNext,
    playable: access && lesson.playable,
    locked: !access,
    index: i,
    total: flat.length,
    prev: nav(flat[i - 1]),
    next: nav(flat[i + 1]),
    signedIn: !!user,
    progress: (progress as Record<number, LessonData['progress']>)[lesson.id] ?? null,
  };
  const outlineView: OutlineView = {
    title: outline.title,
    slug: outline.slug,
    cover: outline.cover,
    totalS: outline.totalS,
    count: outline.count,
    modules: outline.modules.map((m) => ({ id: m.id, title: m.title, lessons: m.lessons.map((l) => ({ id: l.id, slug: l.slug, title: l.title, durationS: l.durationS, isFree: l.isFree, mediaType: l.mediaType })) })),
  };
  return {
    lesson: data,
    outline: outlineView,
    progress: progress as Record<number, { positionS: number; percent: number; completed: boolean }>,
    notes: notes.map((n) => ({ id: n.id, positionS: n.positionS, text: n.text })),
    user,
  };
}
