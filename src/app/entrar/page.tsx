import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, btn } from '@/components/sin/ui';
import { sql } from '@/db';
import { signInAsTest } from '@/server/actions';

export const metadata: Metadata = { title: 'Entrar' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const testers = await sql<{ email: string; name: string }[]>`select email, name from users where is_test order by name limit 30`;
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div className="card pad" style={{ width: 'min(440px, 100%)' }}>
        <Link href="/" className="row-c t-card" style={{ gap: 10 }}>
          <span className="avatar" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--sin-secondary-container)', color: 'var(--sin-on-secondary-container)', fontSize: 12 }}>
            IRB
          </span>
          Academia IRB®
        </Link>
        <h1 className="t-page" style={{ marginTop: 24 }}>
          Entrar
        </h1>
        <p className="t-body-m c-variant" style={{ marginTop: 8 }}>
          Staging: el ingreso con tu contraseña de siempre y con enlace al correo llega en la fase de migración. Por ahora entra con una alumna de prueba.
        </p>
        {error && (
          <p className="risk-note" role="alert">
            <Icon name="error" /> No encontramos esa cuenta de prueba.
          </p>
        )}
        <form action={signInAsTest} style={{ marginTop: 24 }}>
          <input type="hidden" name="next" value={next?.startsWith('/') ? next : '/'} />
          <label htmlFor="email" className="t-label-l" style={{ display: 'block', marginBottom: 8 }}>
            Alumna de prueba
          </label>
          <select id="email" name="email" className="field">
            {testers.map((t) => (
              <option key={t.email} value={t.email}>
                {t.name}
              </option>
            ))}
          </select>
          <button className={btn('primary', 'lg', 'wide')} type="submit" style={{ marginTop: 16 }}>
            Entrar
          </button>
        </form>
        <Link href="/practicas/fuegos" className={btn('plain', 'md', 'wide')} style={{ marginTop: 8 }}>
          Probar la práctica gratuita
        </Link>
      </div>
    </main>
  );
}
