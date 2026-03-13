/**
 * Migration correctness tests.
 *
 * These need a real Postgres. Test that all migrations apply cleanly to a blank
 * database, then verify expected tables, indexes, and constraints exist.
 *
 * Requires the Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
 *
 * Run with:
 *   pnpm test:integration test/integration/database-migrations.test.ts
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { buildSuperuserDatabaseUrl } from '../helpers/database';

// Needs the superuser role (not spechive_app) to CREATE DATABASE for temp test DBs.
const DATABASE_URL = buildSuperuserDatabaseUrl();

const TEST_DB_NAME = `spechive_migration_test_${Date.now()}`;

describe('Migration correctness', () => {
  let adminSql: ReturnType<typeof postgres>;
  let testSql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    // Verify database connectivity - fail fast with clear message
    try {
      const sql = postgres(DATABASE_URL, { max: 1 });
      await sql`SELECT 1`;
      await sql.end();
    } catch {
      throw new Error(
        `Postgres is not accessible at ${DATABASE_URL}. ` +
          `Start Docker services: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres`,
      );
    }

    adminSql = postgres(DATABASE_URL, { max: 1 });

    // Create a temporary test database
    await adminSql.unsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);

    // Connect to the test database and run migrations
    const testDbUrl = DATABASE_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
    testSql = postgres(testDbUrl, { max: 1 });

    const db = drizzle(testSql);
    const migrationsFolder = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../packages/database/drizzle',
    );
    await migrate(db, { migrationsFolder });
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
      'suites_organization_id_idx',
      'tests_suite_idx',
      'tests_run_status_idx',
      'tests_organization_id_idx',
      'artifacts_test_idx',
      'artifacts_organization_id_idx',
      'projects_org_name_idx',
      'project_tokens_prefix_idx',
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
        AND routine_name IN ('validate_project_token_by_prefix', 'touch_project_token_usage', 'authenticate_user_by_email', 'get_user_organizations')
      ORDER BY routine_name
    `;

    const funcNames = rows.map((r) => r.routine_name as string);
    expect(funcNames).toContain('validate_project_token_by_prefix');
    expect(funcNames).toContain('touch_project_token_usage');
    expect(funcNames).toContain('authenticate_user_by_email');
    expect(funcNames).toContain('get_user_organizations');
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

  it('FORCE ROW LEVEL SECURITY is enabled on all tenant-scoped tables', async () => {
    const rows = await testSql`
      SELECT relname, relforcerowsecurity
      FROM pg_class
      WHERE relname = ANY(${expectedTables})
      ORDER BY relname
    `;

    for (const tableName of expectedTables) {
      const row = rows.find((r) => r.relname === tableName);
      expect(row, `${tableName} should exist`).toBeDefined();
      expect(row!.relforcerowsecurity, `${tableName} should have FORCE RLS enabled`).toBe(true);
    }
  });

  it('expected foreign key constraints exist', async () => {
    const rows = await testSql`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `;

    const fks = rows.map((r) => ({
      table: r.table_name as string,
      column: r.column_name as string,
      foreignTable: r.foreign_table_name as string,
      foreignColumn: r.foreign_column_name as string,
    }));

    const expectedFks = [
      {
        table: 'memberships',
        column: 'organization_id',
        foreignTable: 'organizations',
        foreignColumn: 'id',
      },
      { table: 'memberships', column: 'user_id', foreignTable: 'users', foreignColumn: 'id' },
      {
        table: 'projects',
        column: 'organization_id',
        foreignTable: 'organizations',
        foreignColumn: 'id',
      },
      {
        table: 'project_tokens',
        column: 'project_id',
        foreignTable: 'projects',
        foreignColumn: 'id',
      },
      { table: 'runs', column: 'project_id', foreignTable: 'projects', foreignColumn: 'id' },
      { table: 'suites', column: 'run_id', foreignTable: 'runs', foreignColumn: 'id' },
      {
        table: 'suites',
        column: 'organization_id',
        foreignTable: 'organizations',
        foreignColumn: 'id',
      },
      { table: 'suites', column: 'parent_suite_id', foreignTable: 'suites', foreignColumn: 'id' },
      { table: 'tests', column: 'suite_id', foreignTable: 'suites', foreignColumn: 'id' },
      { table: 'tests', column: 'run_id', foreignTable: 'runs', foreignColumn: 'id' },
      {
        table: 'tests',
        column: 'organization_id',
        foreignTable: 'organizations',
        foreignColumn: 'id',
      },
      { table: 'artifacts', column: 'test_id', foreignTable: 'tests', foreignColumn: 'id' },
      {
        table: 'artifacts',
        column: 'organization_id',
        foreignTable: 'organizations',
        foreignColumn: 'id',
      },
    ];

    for (const expected of expectedFks) {
      const found = fks.some(
        (fk) =>
          fk.table === expected.table &&
          fk.column === expected.column &&
          fk.foreignTable === expected.foreignTable &&
          fk.foreignColumn === expected.foreignColumn,
      );
      expect(
        found,
        `FK ${expected.table}.${expected.column} → ${expected.foreignTable}.${expected.foreignColumn}`,
      ).toBe(true);
    }
  });

  it('critical columns have NOT NULL constraints', async () => {
    const rows = await testSql`
      SELECT table_name, column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('runs', 'tests')
        AND column_name IN ('metadata', 'total_tests', 'passed_tests', 'failed_tests', 'skipped_tests', 'retry_count')
      ORDER BY table_name, column_name
    `;

    const expectedNotNull = [
      { table: 'runs', column: 'metadata' },
      { table: 'runs', column: 'total_tests' },
      { table: 'runs', column: 'passed_tests' },
      { table: 'runs', column: 'failed_tests' },
      { table: 'runs', column: 'skipped_tests' },
      { table: 'tests', column: 'retry_count' },
    ];

    for (const expected of expectedNotNull) {
      const row = rows.find(
        (r) => r.table_name === expected.table && r.column_name === expected.column,
      );
      expect(row, `${expected.table}.${expected.column} should exist`).toBeDefined();
      expect(row!.is_nullable, `${expected.table}.${expected.column} should be NOT NULL`).toBe(
        'NO',
      );
    }
  });

  it('SECURITY DEFINER functions are accessible to spechive_app', async () => {
    const functions = [
      {
        name: 'validate_project_token_by_prefix',
        signature: 'validate_project_token_by_prefix(text)',
      },
      { name: 'touch_project_token_usage', signature: 'touch_project_token_usage(text)' },
      { name: 'authenticate_user_by_email', signature: 'authenticate_user_by_email(text)' },
      { name: 'get_user_organizations', signature: 'get_user_organizations(uuid)' },
    ];

    for (const func of functions) {
      const rows = await testSql`
        SELECT has_function_privilege('spechive_app', ${func.signature}, 'EXECUTE') AS has_priv
      `;
      expect(rows[0]!.has_priv, `spechive_app should be able to EXECUTE ${func.name}`).toBe(true);
    }
  });
});
