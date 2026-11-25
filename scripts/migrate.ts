/** Aplica las migraciones de Drizzle y luego el SQL idempotente que Drizzle no modela (triggers). */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
await sql.unsafe(`
  create or replace function outbox_notify() returns trigger language plpgsql as $$
  begin
    perform pg_notify('outbox', new.id::text);
    return new;
  end $$;
  drop trigger if exists events_notify on events;
  create trigger events_notify after insert on events for each row execute function outbox_notify();
`);
// UI Sinapsis: cada notificación nueva se empuja por SSE (canal 'notify', payload = user_id)
await sql.unsafe(`
  create or replace function notif_notify() returns trigger language plpgsql as $$
  begin
    perform pg_notify('notify', new.user_id::text);
    return new;
  end $$;
  drop trigger if exists notifications_notify on notifications;
  create trigger notifications_notify after insert on notifications for each row execute function notif_notify();
`);
console.log('migraciones OK');
await sql.end();
