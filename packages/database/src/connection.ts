import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export function createDbConnection(url?: string) {
  const connectionString = url ?? process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const client = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDbConnection>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
