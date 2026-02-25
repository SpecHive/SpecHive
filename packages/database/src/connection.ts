import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export function createDbConnection(url?: string) {
  const connectionString = url ?? process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const client = postgres(connectionString, {
    max: parseInt(process.env['DB_POOL_MAX'] || '10', 10),
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
