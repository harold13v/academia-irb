import pino from 'pino';

/** Logs JSON. Nunca se registran emails, contraseñas ni tokens. */
export const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { app: process.env.APP_ROLE ?? 'web' },
  redact: { paths: ['email', '*.email', 'password', '*.password', 'token', '*.token', 'authorization'], remove: true },
  timestamp: pino.stdTimeFunctions.isoTime,
});
