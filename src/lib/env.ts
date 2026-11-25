import { z } from 'zod';

/** Variables de entorno validadas al arrancar. Sentry es opcional: sin DSN no se inicializa. */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  APP_SECRET: z.string().min(32),
  PUBLIC_URL: z.string().url().default('http://localhost:4200'),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  BREVO_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success && process.env.NEXT_PHASE !== 'phase-production-build') {
  console.error('Entorno inválido:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}
export const env = (parsed.success ? parsed.data : process.env) as z.infer<typeof schema>;
