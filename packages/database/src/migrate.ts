/* eslint-disable no-console */
import 'dotenv/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export async function runMigrations(connectionString: string): Promise<void> {
  // Migrations must run serially to avoid concurrent DDL conflicts
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = resolve(__dirname, '../drizzle');

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder });
  console.log('Migrations completed successfully.');

  await client.end();
}

// CLI entry point
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }
  runMigrations(url).catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
