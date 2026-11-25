import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LessonProvider } from '@/components/lesson/context';
import { PlayerPage } from '@/components/player/page';
import { getOutline } from '@/server/data';
import { buildLessonView } from '@/server/lesson-view';

export async function generateMetadata(): Promise<Metadata> {
  const o = await getOutline('fuegos');
  if (!o) return {};
  return {
    title: `${o.title} · Práctica guiada`,
    description: `${o.subtitle}. ${Math.round(o.totalS / 60)} minutos con Ximena Duque Valencia.`,
    openGraph: { title: `${o.title} · Práctica guiada con Ximena Duque Valencia`, description: `${Math.round(o.totalS / 60)} minutos para purificar tus espacios, tus emociones y tus patrones.`, type: 'website', locale: 'es_LA' },
  };
}

/** Enlace público de Fuegos para compartir: solo la práctica, sin acceso al resto de la plataforma (ver middleware). */
export default async function FuegosKiosk() {
  const v = await buildLessonView('fuegos', null, '/fuegos');
  if (!v) notFound();
  const user = v.user ? { name: v.user.name, reminderHour: v.user.reminderHour ?? null, soundOn: v.user.soundOn } : null;
  return (
    <LessonProvider initial={v.lesson} initialNotes={v.notes}>
      <PlayerPage outline={v.outline} progress={v.progress} user={user} kiosk />
    </LessonProvider>
  );
}
