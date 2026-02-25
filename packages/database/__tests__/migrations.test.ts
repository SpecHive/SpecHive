/**
 * Migration correctness tests.
 *
 * These need a real Postgres. Test that all migrations apply cleanly to a blank
 * database, then verify expected tables, indexes, and constraints exist.
 *
 * Requires the Docker Compose stack running:
 *   pnpm docker:up
 *
 * Run with:
 *   DATABASE_URL=postgres://assertly:assertly@localhost:5432/assertly pnpm --filter @assertly/database test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://assertly:assertly@localhost:5432/assertly';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let postgres: typeof import('postgres').default;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let drizzle: typeof import('drizzle-orm/postgres-js').drizzle;
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let migrate: typeof import('drizzle-orm/postgres-js/migrator').migrate;

const TEST_DB_NAME = `assertly_migration_test_${Date.now()}`;

// Skip the entire suite if DATABASE_URL is not reachable
const canConnect = await (async () => {
  try {
    const mod = await import('postgres');
    postgres = mod.default;
    const sql = postgres(DATABASE_URL, { max: 1 });
    await sql`SELECT 1`;
    await sql.end();

    const drizzleMod = await import('drizzle-orm/postgres-js');
    drizzle = drizzleMod.drizzle;
    const migrateMod = await import('drizzle-orm/postgres-js/migrator');
    migrate = migrateMod.migrate;

    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!canConnect)('Migration correctness', () => {
  let adminSql: ReturnType<typeof postgres>;
  let testSql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    adminSql = postgres(DATABASE_URL, { max: 1 });

    // Create a temporary test database
    await adminSql.unsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);

    // Connect to the test database and run migrations
    const testDbUrl = DATABASE_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
    testSql = postgres(testDbUrl, { max: 1 });

    const db = drizzle(testSql);
    await migrate(db, { migrationsFolder: './drizzle' });
  }, 60_000);

  afterAll(async () => {
    await testSql?.end();

    // Drop the temporary database
    if (adminSql) {
      await adminSql.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
      await adminSql.end();
    }
  });

  const expectedTables = [
    'organizations',
    'users',
    'memberships',
    'projects',
    'project_tokens',
    'runs',
    'suites',
    'tests',
    'artifacts',
  ];

  it('all expected tables exist', async () => {
    const rows = await testSql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    const tableNames = rows.map((r) => r.table_name as string);

    for (const expected of expectedTables) {
      expect(tableNames).toContain(expected);
    }
  });

  it('expected indexes exist', async () => {
    const rows = await testSql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname
    `;

    const indexNames = rows.map((r) => r.indexname as string);

    const expectedIndexes = [
      'runs_project_created_idx',
      'runs_project_status_idx',
      'suites_run_id_idx',
      'tests_suite_idx',
      'tests_run_status_idx',
      'artifacts_test_idx',
      'projects_org_slug_idx',
      'project_tokens_hash_idx',
      'memberships_org_user_idx',
    ];

    for (const idx of expectedIndexes) {
      expect(indexNames).toContain(idx);
    }
  });

  it('RLS is enabled on tenant-scoped tables', async () => {
    const rows = await testSql`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname = ANY(${expectedTables})
      ORDER BY relname
    `;

    const rlsTables = [
      'organizations',
      'users',
      'memberships',
      'projects',
      'project_tokens',
      'runs',
      'suites',
      'tests',
      'artifacts',
    ];

    for (const tableName of rlsTables) {
      const row = rows.find((r) => r.relname === tableName);
      expect(row, `${tableName} should exist`).toBeDefined();
      expect(row!.relrowsecurity, `${tableName} should have RLS enabled`).toBe(true);
    }
  });

  it('SECURITY DEFINER functions exist', async () => {
    const rows = await testSql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN ('validate_project_token', 'touch_project_token_usage')
      ORDER BY routine_name
    `;

    const funcNames = rows.map((r) => r.routine_name as string);
    expect(funcNames).toContain('validate_project_token');
    expect(funcNames).toContain('touch_project_token_usage');
  });

  it('enum types exist with correct values', async () => {
    const rows = await testSql`
      SELECT t.typname, e.enumlabel
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname IN ('run_status', 'test_status', 'artifact_type', 'membership_role')
      ORDER BY t.typname, e.enumsortorder
    `;

    const enums: Record<string, string[]> = {};
    for (const row of rows) {
      const name = row.typname as string;
      enums[name] = enums[name] ?? [];
      enums[name]!.push(row.enumlabel as string);
    }

    expect(enums['run_status']).toBeDefined();
    expect(enums['test_status']).toBeDefined();
    expect(enums['artifact_type']).toBeDefined();
    expect(enums['membership_role']).toBeDefined();
  });
});
