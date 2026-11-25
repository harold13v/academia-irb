import Redis from 'ioredis';

const g = globalThis as unknown as { redis?: Redis };
/** Redis 7 propio (127.0.0.1:6390): caché, rate limit, presencia, rankings y colas BullMQ. */
export const redis = g.redis ?? new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null, enableAutoPipelining: true, lazyConnect: false });
if (process.env.NODE_ENV !== 'production') g.redis = redis;

/** Ventana fija por clave. Devuelve false si se pasó del límite. */
export async function rateLimit(key: string, max: number, windowS: number) {
  const k = `rl:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowS);
  return n <= max;
}

/** Caché simple con TTL para catálogo y temario (se invalida por etiqueta desde el admin). */
export async function cached<T>(key: string, ttlS: number, load: () => Promise<T>): Promise<T> {
  const hit = await redis.get(`c:${key}`).catch(() => null);
  if (hit) return JSON.parse(hit) as T;
  const v = await load();
  await redis.set(`c:${key}`, JSON.stringify(v), 'EX', ttlS).catch(() => {});
  return v;
}
