/** Sentry en servidor: solo si hay DSN. Sin DSN no se carga nada y la app sigue igual. */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, environment: 'staging' });
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  (Sentry.captureRequestError as (...a: unknown[]) => void)(...args);
}
