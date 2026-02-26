import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export function createDbConnection(url: string, poolMax = 10) {
  const client = postgres(url, {
    max: poolMax,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDbConnection>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Sets the RLS tenant context for the current transaction (must be called inside db.transaction). */
export async function setTenantContext(tx: Transaction, organizationId: string) {
  await tx.execute(sql`SELECT set_config('app.current_organization_id', ${organizationId}, true)`);
}

/** Extracts the raw postgres-js client from a Drizzle instance or transaction. */
export function getRawClient(db: Database | Transaction): postgres.Sql {
  // Database instances expose $client directly
  const direct = (db as unknown as { $client?: postgres.Sql }).$client;
  if (direct) return direct;

  // Transactions expose the client via the internal session
  const session = (db as unknown as { session?: { client?: postgres.Sql } }).session;
  if (session?.client) return session.client;

  throw new Error('Failed to extract raw client from Drizzle instance');
}
