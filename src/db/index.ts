import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const g = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
export const sql = g.pg ?? postgres(process.env.DATABASE_URL!, { max: 10, idle_timeout: 30, prepare: true });
if (process.env.NODE_ENV !== 'production') g.pg = sql;
export const db = drizzle(sql, { schema });
export { schema };
