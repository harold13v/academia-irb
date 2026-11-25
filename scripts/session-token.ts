/** Imprime un JWT de sesión para una alumna de demo (para Playwright: IRB_SESSION). Uso: npm run session:token -- alumna01@demo.test */
import { SignJWT } from 'jose';
import postgres from 'postgres';

const email = process.argv[2] ?? 'alumna01@demo.test';
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const [u] = await sql<{ id: string }[]>`select id from users where email = ${email} and is_test`;
await sql.end();
if (!u) {
  console.error(`No existe la alumna de demo ${email}. Corre primero npm run db:seed:demo.`);
  process.exit(1);
}
const jwt = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(u.id).setIssuedAt().setExpirationTime('30d').sign(new TextEncoder().encode(process.env.APP_SECRET!));
console.log(jwt);
