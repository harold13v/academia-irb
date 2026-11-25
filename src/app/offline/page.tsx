import { Empty } from '@/components/sin/ui';

export const metadata = { title: 'Sin conexión' };

export default function Offline() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ display: 'grid', justifyItems: 'center' }}>
        <Empty icon="refresh" title="Estás sin conexión">
          Tu práctica quedó guardada en este dispositivo. Cuando vuelva la señal, retomas donde quedaste.
        </Empty>
        <a className="btn primary" href="/">
          Intentar de nuevo
        </a>
      </div>
    </main>
  );
}
