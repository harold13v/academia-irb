import type { Metadata } from 'next';
import { Eyebrow, Title } from '@/components/rayo/title';
import Link from 'next/link';
import { CirclePanel } from '@/components/circle';
import { btn } from '@/components/sin/ui';
import { currentUser } from '@/server/session';
import { circleToday } from '@/server/social';

export const metadata: Metadata = { title: 'Círculos' };

export default async function Circles() {
  const user = await currentUser();
  return (
    <div className="page-pad" style={{ maxWidth: 760 }}>
      <div className="stack" style={{ gap: 12, margin: '8px 0 32px' }}>
        <Eyebrow>Practicar acompañada</Eyebrow>
        <Title className="t-page" text="Tus" em="círculos." />
      </div>
      {user ? (
        <CirclePanel optedIn={user.circlesOptIn} today={await circleToday(user.id, user.timezone)} />
      ) : (
        <Link className={btn('primary', 'lg')} href="/entrar?next=/circulos">
          Entrar para unirte
        </Link>
      )}
    </div>
  );
}
