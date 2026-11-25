import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LessonSync } from '@/components/lesson/context';
import { buildLessonView } from '@/server/lesson-view';

type P = Promise<{ curso: string; clase: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const { curso, clase } = await params;
  const v = await buildLessonView(curso, clase, `/cursos/${curso}`);
  return { title: v ? `${v.lesson.title} · ${v.outline.title}` : 'Clase' };
}

/** Solo cambia la clase activa del reproductor persistente (layout). */
export default async function LessonPage({ params }: { params: P }) {
  const { curso, clase } = await params;
  const v = await buildLessonView(curso, clase, `/cursos/${curso}`);
  if (!v) notFound();
  return <LessonSync lesson={v.lesson} notes={v.notes} />;
}
