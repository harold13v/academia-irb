import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LessonProvider } from '@/components/lesson/context';
import { PlayerPage } from '@/components/player/page';
import { ShellProvider } from '@/components/sin/shell';
import { getOutline } from '@/server/data';
import { buildLessonView } from '@/server/lesson-view';
import { getShellData } from '@/server/shell';

type P = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const o = await getOutline((await params).slug);
  if (!o) return {};
  return {
    title: `${o.title} · Práctica guiada`,
    description: `${o.subtitle}. ${Math.round(o.totalS / 60)} minutos con Ximena Duque Valencia.`,
    openGraph: { title: `${o.title} · Práctica guiada con Ximena Duque Valencia`, description: `${Math.round(o.totalS / 60)} minutos para purificar tus espacios, tus emociones y tus patrones.`, type: 'website', locale: 'es_LA' },
  };
}

/** Práctica gratuita, pública y sin login (Fuegos). Misma ruta y mismo enlace al embudo FAM 2027; solo cambia la piel. */
export default async function PracticePage({ params }: { params: P }) {
  const { slug } = await params;
  const o = await getOutline(slug);
  if (!o || o.kind !== 'practice') notFound();
  const [v, shell] = await Promise.all([buildLessonView(slug, null, `/practicas`), getShellData()]);
  if (!v) notFound();
  const user = v.user ? { name: v.user.name, reminderHour: v.user.reminderHour ?? null, soundOn: v.user.soundOn } : null;
  return (
    <ShellProvider data={shell}>
      <LessonProvider initial={v.lesson} initialNotes={v.notes}>
        <PlayerPage outline={v.outline} progress={v.progress} user={user} />
      </LessonProvider>
    </ShellProvider>
  );
}
