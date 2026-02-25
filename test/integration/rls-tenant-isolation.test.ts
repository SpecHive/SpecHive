/**
 * RLS tenant isolation integration tests.
 *
 * These tests require the full Docker Compose stack with a migrated database:
 *   pnpm docker:up && pnpm db:migrate
 *
 * Run with:
 *   pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgres://assertly:assertly@localhost:5432/assertly';
const APP_DATABASE_URL =
  process.env['APP_DATABASE_URL'] ?? 'postgres://assertly_app:assertly_app@localhost:5432/assertly';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let postgres: typeof import('postgres').default;

async function loadPostgres() {
  const mod = await import('postgres');
  postgres = mod.default;
}

// Two org UUIDs used across all tests (deterministic to simplify cleanup)
const ORG_A_ID = '00000000-0000-4000-a000-aaaaaaaaaaaa';
const ORG_B_ID = '00000000-0000-4000-a000-bbbbbbbbbbbb';
const PROJECT_A_ID = '00000000-0000-4000-a000-aaaa00000001';
const PROJECT_B_ID = '00000000-0000-4000-a000-bbbb00000001';

describe('RLS tenant isolation', () => {
  let superSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    await loadPostgres();

    superSql = postgres(DATABASE_URL, { max: 1 });
    appSql = postgres(APP_DATABASE_URL, { max: 1 });

    // Verify database is reachable
    await superSql`SELECT 1`;

    // Clean up any leftover test data (reverse dependency order)
    await superSql`DELETE FROM projects WHERE id IN (${PROJECT_A_ID}, ${PROJECT_B_ID})`;
    await superSql`DELETE FROM organizations WHERE id IN (${ORG_A_ID}, ${ORG_B_ID})`;

    // Seed two orgs with separate projects (as superuser, bypasses RLS)
    await superSql`
      INSERT INTO organizations (id, name, slug)
      VALUES
        (${ORG_A_ID}, 'Org A', 'org-a'),
        (${ORG_B_ID}, 'Org B', 'org-b')
    `;
    await superSql`
      INSERT INTO projects (id, organization_id, name, slug)
      VALUES
        (${PROJECT_A_ID}, ${ORG_A_ID}, 'Project A', 'proj-a'),
        (${PROJECT_B_ID}, ${ORG_B_ID}, 'Project B', 'proj-b')
    `;
  }, 30_000);

  afterAll(async () => {
    // Clean up test data
    await superSql`DELETE FROM projects WHERE id IN (${PROJECT_A_ID}, ${PROJECT_B_ID})`;
    await superSql`DELETE FROM organizations WHERE id IN (${ORG_A_ID}, ${ORG_B_ID})`;

    await superSql.end();
    await appSql.end();
  });

  it('org A context → can query org A projects', async () => {
    const rows = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
      return tx`SELECT id FROM projects WHERE organization_id = ${ORG_A_ID}`;
    });

    expect(rows.length).toBe(1);
    expect(rows[0]!.id).toBe(PROJECT_A_ID);
  });

  it('org A context → org B projects return zero rows', async () => {
    const rows = await appSql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
      return tx`SELECT id FROM projects WHERE organization_id = ${ORG_B_ID}`;
    });

    expect(rows.length).toBe(0);
  });

  it('without context set → all queries return zero rows (fail-closed)', async () => {
    const rows = await appSql.begin(async (tx) => {
      // Reset to empty string to simulate no context
      await tx`SELECT set_config('app.current_organization_id', '', true)`;
      // This should fail or return zero rows since '' is not a valid UUID
      try {
        return await tx`SELECT id FROM projects`;
      } catch {
        // Expected: casting '' to uuid fails, which is fail-closed behavior
        return [];
      }
    });

    expect(rows.length).toBe(0);
  });

  it('superuser role bypasses RLS', async () => {
    const rows =
      await superSql`SELECT id FROM projects WHERE id IN (${PROJECT_A_ID}, ${PROJECT_B_ID}) ORDER BY id`;

    expect(rows.length).toBe(2);
  });
});
