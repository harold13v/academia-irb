import Link from 'next/link';
import { Empty, btn } from '@/components/sin/ui';

export default function NotFound() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div>
        <Empty icon="search" title="No encontramos esta página">
          Puede que el enlace haya cambiado. Tus cursos siguen en su lugar.
        </Empty>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <Link className={btn('primary', 'lg')} href="/">
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
