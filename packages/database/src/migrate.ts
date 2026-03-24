/* eslint-disable no-console */
import 'dotenv/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

type SqlClient = ReturnType<typeof postgres>;

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, '../drizzle');

export async function runMigrations(connectionString: string): Promise<void> {
  const client = postgres(connectionString, { max: 1 });

  try {
    await bootstrapDatabase(client);

    const { runMigrations: runOutboxyMigrations } = await import('@outboxy/migrations');
    await runOutboxyMigrations(connectionString);

    console.log('Running Drizzle migrations...');
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    console.log('Drizzle migrations completed.');

    await grantOutboxyAccess(client);
  } finally {
    await client.end();
  }
}

/**
 * Creates extensions, roles, and sets default privileges.
 * Replaces docker/postgres/init.sh — idempotent, safe to re-run.
 */
async function bootstrapDatabase(client: SqlClient): Promise<void> {
  const spechiveAppPassword = process.env['SPECHIVE_APP_PASSWORD'] ?? 'spechive_app';
  const outboxyPassword = process.env['OUTBOXY_PASSWORD'] ?? 'outboxy';

  console.log('Bootstrapping database: extensions, roles, privileges...');

  await client.unsafe('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await client.unsafe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Pass passwords via session GUCs so DO blocks can read them safely
  await client`SELECT set_config('app.spechive_app_pw', ${spechiveAppPassword}, false)`;
  await client`SELECT set_config('app.outboxy_pw', ${outboxyPassword}, false)`;

  // Application role (subject to RLS)
  await client.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'spechive_app') THEN
        EXECUTE format('CREATE ROLE spechive_app LOGIN PASSWORD %L', current_setting('app.spechive_app_pw'));
      ELSE
        EXECUTE format('ALTER ROLE spechive_app PASSWORD %L', current_setting('app.spechive_app_pw'));
      END IF;
    END
    $$
  `);

  await client.unsafe(
    `DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO spechive_app', current_database()); END $$`,
  );
  await client.unsafe('GRANT USAGE ON SCHEMA public TO spechive_app');
  await client.unsafe(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO spechive_app',
  );
  await client.unsafe('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO spechive_app');
  await client.unsafe(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO spechive_app',
  );
  await client.unsafe(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO spechive_app',
  );

  // Outboxy role — explicit grants only, no default privileges
  await client.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'outboxy') THEN
        EXECUTE format('CREATE ROLE outboxy LOGIN PASSWORD %L', current_setting('app.outboxy_pw'));
      ELSE
        EXECUTE format('ALTER ROLE outboxy PASSWORD %L', current_setting('app.outboxy_pw'));
      END IF;
    END
    $$
  `);

  await client.unsafe(
    `DO $$ BEGIN EXECUTE format('GRANT CONNECT ON DATABASE %I TO outboxy', current_database()); END $$`,
  );
  await client.unsafe('GRANT USAGE ON SCHEMA public TO outboxy');

  console.log('Bootstrap complete.');
}

/** Grants outboxy access to only its own tables (outbox_events, inbox_events). */
async function grantOutboxyAccess(client: SqlClient): Promise<void> {
  console.log('Granting outboxy access to outbox tables...');
  await client.unsafe(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON outbox_events, inbox_events TO outboxy',
  );
  console.log('Outboxy grants complete.');
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
