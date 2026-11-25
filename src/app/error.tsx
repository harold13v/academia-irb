'use client';

import { Empty, btn } from '@/components/sin/ui';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ display: 'grid', justifyItems: 'center' }}>
        <Empty icon="refresh" title="Algo no cargó bien">
          Revisa tu conexión y vuelve a intentar. Tu avance está guardado.
        </Empty>
        <button className={btn('primary')} type="button" onClick={reset}>
          Reintentar
        </button>
      </div>
    </main>
  );
}
