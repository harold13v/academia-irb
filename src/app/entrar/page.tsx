import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Eyebrow, Title } from '@/components/rayo/title';
import { Icon, btn } from '@/components/sin/ui';
import { sql } from '@/db';
import { signInAsTest } from '@/server/actions';

export const metadata: Metadata = { title: 'Entrar' };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const testers = await sql<{ email: string; name: string }[]>`select email, name from users where is_test order by name limit 30`;
  return (
    <main className="signin">
      <header className="signin-top">
        <Link href="/" aria-label="Academia IRB® · inicio">
          <Image src="/brand/irb-ximena.png" alt="IRB® Ximena Duque Valencia" width={150} height={26} priority />
        </Link>
        <p className="signin-tag">
          <b>Indigo</b> · <b>Ray</b> · <b>Balancing</b>
          <br />
          Academia de evolución de la conciencia
        </p>
      </header>

      <div className="signin-copy">
        <Eyebrow>Academia IRB®</Eyebrow>
        <Title text="Tu práctica" em="empieza aquí." />
        <p className="signin-lead">Cursos, programas y prácticas guiadas con Ximena Duque Valencia. Retoma donde quedaste, a tu ritmo, desde cualquier pantalla.</p>

        <div className="signin-box">
          <p className="signin-note">Staging: el ingreso con tu contraseña de siempre y con enlace al correo llega en la fase de migración. Por ahora entra con una alumna de prueba.</p>
          {error && (
            <p className="risk-note" role="alert">
              <Icon name="error" /> No encontramos esa cuenta de prueba.
            </p>
          )}
          <form action={signInAsTest} className="stack" style={{ gap: 12 }}>
            <input type="hidden" name="next" value={next?.startsWith('/') ? next : '/'} />
            <label htmlFor="email">Alumna de prueba</label>
            <select id="email" name="email" className="field">
              {testers.map((t) => (
                <option key={t.email} value={t.email}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className={btn('primary', 'lg', 'wide')} type="submit" data-magnetic>
              Entrar a mi práctica <span aria-hidden="true">→</span>
            </button>
          </form>
          <Link href="/practicas/fuegos" className={btn('plain', 'md', 'wide')}>
            Probar la práctica gratuita · Fuegos
          </Link>
        </div>

        <p className="signin-stats">
          <span>
            <b>200 mil+</b> personas
          </span>
          <span>
            <b>18</b> países
          </span>
          <span>
            <b>20</b> años
          </span>
        </p>
      </div>

      <div className="signin-art" aria-hidden="true">
        <span className="orbit" />
        <span className="orbit" />
        <Image src="/brand/ximena.webp" alt="" fill priority sizes="(min-width: 960px) 620px, 78vw" />
      </div>
    </main>
  );
}
