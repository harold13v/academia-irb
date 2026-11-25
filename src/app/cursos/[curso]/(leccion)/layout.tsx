import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { LessonProvider } from '@/components/lesson/context';
import { PlayerPage } from '@/components/player/page';
import { ShellProvider } from '@/components/sin/shell';
import { buildLessonView } from '@/server/lesson-view';
import { getShellData } from '@/server/shell';

/**
 * Layout persistente de la clase: el reproductor y el panel derecho viven aquí y NO se remontan al pasar
 * de una clase a otra; la página hija solo cambia la clase activa (LessonSync). El render inicial sale del servidor
 * con la clase de la URL (x-pathname lo pone el middleware), así el póster es el LCP y no hay salto de layout.
 */
export default async function LessonLayout({ children, params }: { children: React.ReactNode; params: Promise<{ curso: string }> }) {
  const { curso } = await params;
  const path = (await headers()).get('x-pathname') ?? '';
  const clase = path.split('/')[3] ?? null;
  const [v, shell] = await Promise.all([buildLessonView(curso, clase, `/cursos/${curso}`), getShellData()]);
  if (!v) notFound();
  const user = v.user ? { name: v.user.name, reminderHour: v.user.reminderHour ?? null, soundOn: v.user.soundOn } : null;
  return (
    <ShellProvider data={shell}>
      <LessonProvider initial={v.lesson} initialNotes={v.notes}>
        <PlayerPage outline={v.outline} progress={v.progress} user={user} />
        {children}
      </LessonProvider>
    </ShellProvider>
  );
}
