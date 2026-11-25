import { cookies } from 'next/headers';
import { AppShell } from '@/components/sin/shell';
import { getShellData } from '@/server/shell';

/** Shell persistente (sidebar, barra superior, barra móvil, ⌘K, notificaciones): no se remonta al navegar. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [data, jar] = await Promise.all([getShellData(), cookies()]);
  return (
    <AppShell data={data} collapsed={jar.get('irb_sb')?.value === '1'}>
      {children}
    </AppShell>
  );
}
