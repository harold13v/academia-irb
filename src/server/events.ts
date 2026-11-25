import type { TransactionSql } from 'postgres';

/** Escribe un evento en el outbox dentro de la transacción del efecto. El trigger hace NOTIFY al worker. */
export async function emit(// eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: TransactionSql<any>, subject: string, name: string, props: Record<string, unknown>, idempotencyKey: string) {
  await tx`insert into events (subject, name, props, idempotency_key) values (${subject}, ${name}, ${JSON.stringify(props)}::jsonb, ${idempotencyKey})
    on conflict (idempotency_key) do nothing`;
}
