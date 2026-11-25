/** Sentry en el navegador: chunk aparte que solo se descarga si hay DSN público. */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import('@sentry/nextjs').then((Sentry) => Sentry.init({ dsn, tracesSampleRate: 0.05, environment: 'staging' }));
}
