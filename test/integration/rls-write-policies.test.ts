/**
 * RLS write-path (INSERT/UPDATE) isolation tests.
 *
 * Verifies that the app role (`assertly_app`) cannot insert or update rows
 * across tenant boundaries. Requires Docker Compose postgres with a migrated
 * database:
 *   docker compose up -d postgres && pnpm db:migrate
 *
 * Run with:
 *   pnpm test:integration:db
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const DATABASE_URL =
  process.env['ADMIN_DATABASE_URL'] ??
  (() => {
    const user = process.env['POSTGRES_USER'] ?? 'assertly';
    const pass = process.env['POSTGRES_PASSWORD'] ?? 'assertly';
    const db = process.env['POSTGRES_DB'] ?? 'assertly';
    return `postgres://${user}:${pass}@localhost:5432/${db}`;
  })();

const APP_DATABASE_URL =
  process.env['APP_DATABASE_URL'] ??
  process.env['DATABASE_URL'] ??
  'postgres://assertly_app:assertly_app@localhost:5432/assertly';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let postgres: typeof import('postgres').default;

async function loadPostgres() {
  const mod = await import('postgres');
  postgres = mod.default;
}

// Deterministic UUIDs for two organizations and their data
const ORG_A_ID = '00000000-0000-4000-b000-aaaaaaaaaaaa';
const ORG_B_ID = '00000000-0000-4000-b000-bbbbbbbbbbbb';
const PROJECT_A_ID = '00000000-0000-4000-b000-aaaa00000001';
const PROJECT_B_ID = '00000000-0000-4000-b000-bbbb00000001';
const RUN_A_ID = '00000000-0000-4000-b000-aaaa00000010';
const RUN_B_ID = '00000000-0000-4000-b000-bbbb00000010';
const SUITE_A_ID = '00000000-0000-4000-b000-aaaa00000020';
const SUITE_B_ID = '00000000-0000-4000-b000-bbbb00000020';
const TEST_A_ID = '00000000-0000-4000-b000-aaaa00000030';
const TEST_B_ID = '00000000-0000-4000-b000-bbbb00000030';
const ARTIFACT_A_ID = '00000000-0000-4000-b000-aaaa00000040';
const ARTIFACT_B_ID = '00000000-0000-4000-b000-bbbb00000040';
const TOKEN_A_ID = '00000000-0000-4000-b000-aaaa00000050';
const TOKEN_B_ID = '00000000-0000-4000-b000-bbbb00000050';

// Extra IDs for INSERT tests
const NEW_PROJECT_ID = '00000000-0000-4000-b000-aaaa00000099';
const NEW_TOKEN_ID = '00000000-0000-4000-b000-aaaa00000098';

describe('RLS write-path isolation', () => {
  let superSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    await loadPostgres();

    superSql = postgres(DATABASE_URL, { max: 1 });
    appSql = postgres(APP_DATABASE_URL, { max: 1 });

    await superSql`SELECT 1`;

    // Clean up leftover test data (reverse dependency order)
    await superSql`DELETE FROM artifacts WHERE id IN (${ARTIFACT_A_ID}, ${ARTIFACT_B_ID})`;
    await superSql`DELETE FROM tests WHERE id IN (${TEST_A_ID}, ${TEST_B_ID})`;
    await superSql`DELETE FROM suites WHERE id IN (${SUITE_A_ID}, ${SUITE_B_ID})`;
    await superSql`DELETE FROM runs WHERE id IN (${RUN_A_ID}, ${RUN_B_ID})`;
    await superSql`DELETE FROM project_tokens WHERE id IN (${TOKEN_A_ID}, ${TOKEN_B_ID}, ${NEW_TOKEN_ID})`;
    await superSql`DELETE FROM projects WHERE id IN (${PROJECT_A_ID}, ${PROJECT_B_ID}, ${NEW_PROJECT_ID})`;
    await superSql`DELETE FROM organizations WHERE id IN (${ORG_A_ID}, ${ORG_B_ID})`;

    // Seed two orgs with data (as superuser, bypasses RLS)
    await superSql`
      INSERT INTO organizations (id, name, slug)
      VALUES
        (${ORG_A_ID}, 'Write Org A', 'write-org-a'),
        (${ORG_B_ID}, 'Write Org B', 'write-org-b')
    `;
    await superSql`
      INSERT INTO projects (id, organization_id, name, slug)
      VALUES
        (${PROJECT_A_ID}, ${ORG_A_ID}, 'Write Project A', 'write-proj-a'),
        (${PROJECT_B_ID}, ${ORG_B_ID}, 'Write Project B', 'write-proj-b')
    `;
    await superSql`
      INSERT INTO project_tokens (id, project_id, name, token_hash)
      VALUES
        (${TOKEN_A_ID}, ${PROJECT_A_ID}, 'Token A', 'write-hash-a'),
        (${TOKEN_B_ID}, ${PROJECT_B_ID}, 'Token B', 'write-hash-b')
    `;
    await superSql`
      INSERT INTO runs (id, project_id, status, metadata, total_tests, passed_tests, failed_tests, skipped_tests)
      VALUES
        (${RUN_A_ID}, ${PROJECT_A_ID}, 'running', '{}', 0, 0, 0, 0),
        (${RUN_B_ID}, ${PROJECT_B_ID}, 'running', '{}', 0, 0, 0, 0)
    `;
    await superSql`
      INSERT INTO suites (id, run_id, organization_id, name)
      VALUES
        (${SUITE_A_ID}, ${RUN_A_ID}, ${ORG_A_ID}, 'Write Suite A'),
        (${SUITE_B_ID}, ${RUN_B_ID}, ${ORG_B_ID}, 'Write Suite B')
    `;
    await superSql`
      INSERT INTO tests (id, suite_id, run_id, organization_id, name, status, retry_count)
      VALUES
        (${TEST_A_ID}, ${SUITE_A_ID}, ${RUN_A_ID}, ${ORG_A_ID}, 'Write Test A', 'passed', 0),
        (${TEST_B_ID}, ${SUITE_B_ID}, ${RUN_B_ID}, ${ORG_B_ID}, 'Write Test B', 'passed', 0)
    `;
    await superSql`
      INSERT INTO artifacts (id, test_id, organization_id, type, name, storage_path)
      VALUES
        (${ARTIFACT_A_ID}, ${TEST_A_ID}, ${ORG_A_ID}, 'log', 'write-artifact-a.log', '/artifacts/wa.log'),
        (${ARTIFACT_B_ID}, ${TEST_B_ID}, ${ORG_B_ID}, 'log', 'write-artifact-b.log', '/artifacts/wb.log')
    `;
  }, 30_000);

  afterAll(async () => {
    await superSql`DELETE FROM artifacts WHERE id IN (${ARTIFACT_A_ID}, ${ARTIFACT_B_ID})`;
    await superSql`DELETE FROM tests WHERE id IN (${TEST_A_ID}, ${TEST_B_ID})`;
    await superSql`DELETE FROM suites WHERE id IN (${SUITE_A_ID}, ${SUITE_B_ID})`;
    await superSql`DELETE FROM runs WHERE id IN (${RUN_A_ID}, ${RUN_B_ID})`;
    await superSql`DELETE FROM project_tokens WHERE id IN (${TOKEN_A_ID}, ${TOKEN_B_ID}, ${NEW_TOKEN_ID})`;
    await superSql`DELETE FROM projects WHERE id IN (${PROJECT_A_ID}, ${PROJECT_B_ID}, ${NEW_PROJECT_ID})`;
    await superSql`DELETE FROM organizations WHERE id IN (${ORG_A_ID}, ${ORG_B_ID})`;

    await superSql.end();
    await appSql.end();
  });

  describe('INSERT isolation: projects', () => {
    afterAll(async () => {
      // Clean up any project we may have inserted
      await superSql`DELETE FROM projects WHERE id = ${NEW_PROJECT_ID}`;
    });

    it('org A context → can insert a project under org A', async () => {
      await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        await tx`
          INSERT INTO projects (id, organization_id, name, slug)
          VALUES (${NEW_PROJECT_ID}, ${ORG_A_ID}, 'New Project A', 'new-proj-a')
        `;
      });

      // Verify via superuser
      const rows = await superSql`SELECT id FROM projects WHERE id = ${NEW_PROJECT_ID}`;
      expect(rows.length).toBe(1);

      // Clean up for next test
      await superSql`DELETE FROM projects WHERE id = ${NEW_PROJECT_ID}`;
    });

    it('org A context → cannot insert a project under org B', async () => {
      await expect(
        appSql.begin(async (tx) => {
          await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
          await tx`
            INSERT INTO projects (id, organization_id, name, slug)
            VALUES (${NEW_PROJECT_ID}, ${ORG_B_ID}, 'Cross-Org Project', 'cross-proj')
          `;
        }),
      ).rejects.toThrow();

      // Verify nothing was inserted
      const rows = await superSql`SELECT id FROM projects WHERE id = ${NEW_PROJECT_ID}`;
      expect(rows.length).toBe(0);
    });
  });

  describe('UPDATE isolation: projects', () => {
    it('org A context → can update org A project', async () => {
      await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        await tx`UPDATE projects SET name = 'Updated Project A' WHERE id = ${PROJECT_A_ID}`;
      });

      const rows = await superSql`SELECT name FROM projects WHERE id = ${PROJECT_A_ID}`;
      expect(rows[0]!.name).toBe('Updated Project A');

      // Restore original name
      await superSql`UPDATE projects SET name = 'Write Project A' WHERE id = ${PROJECT_A_ID}`;
    });

    it('org A context → cannot update org B project (zero rows affected)', async () => {
      await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        const result = await tx`UPDATE projects SET name = 'Hacked' WHERE id = ${PROJECT_B_ID}`;
        expect(result.count).toBe(0);
      });

      // Verify org B project unchanged
      const rows = await superSql`SELECT name FROM projects WHERE id = ${PROJECT_B_ID}`;
      expect(rows[0]!.name).toBe('Write Project B');
    });
  });

  describe('project_tokens isolation', () => {
    afterAll(async () => {
      await superSql`DELETE FROM project_tokens WHERE id = ${NEW_TOKEN_ID}`;
    });

    it('org A context → can see org A tokens', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM project_tokens WHERE id IN (${TOKEN_A_ID}, ${TOKEN_B_ID})`;
      });

      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(TOKEN_A_ID);
    });

    it('org A context → cannot see org B tokens', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM project_tokens WHERE id = ${TOKEN_B_ID}`;
      });

      expect(rows.length).toBe(0);
    });

    it('org A context → can insert a token for org A project', async () => {
      await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        await tx`
          INSERT INTO project_tokens (id, project_id, name, token_hash)
          VALUES (${NEW_TOKEN_ID}, ${PROJECT_A_ID}, 'New Token', 'new-hash-a')
        `;
      });

      const rows = await superSql`SELECT id FROM project_tokens WHERE id = ${NEW_TOKEN_ID}`;
      expect(rows.length).toBe(1);

      await superSql`DELETE FROM project_tokens WHERE id = ${NEW_TOKEN_ID}`;
    });

    it('org A context → cannot insert a token for org B project', async () => {
      await expect(
        appSql.begin(async (tx) => {
          await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
          await tx`
            INSERT INTO project_tokens (id, project_id, name, token_hash)
            VALUES (${NEW_TOKEN_ID}, ${PROJECT_B_ID}, 'Cross-Org Token', 'cross-hash')
          `;
        }),
      ).rejects.toThrow();

      const rows = await superSql`SELECT id FROM project_tokens WHERE id = ${NEW_TOKEN_ID}`;
      expect(rows.length).toBe(0);
    });

    it('org A context → cannot update org B token', async () => {
      await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        const result = await tx`UPDATE project_tokens SET name = 'Hacked' WHERE id = ${TOKEN_B_ID}`;
        expect(result.count).toBe(0);
      });

      const rows = await superSql`SELECT name FROM project_tokens WHERE id = ${TOKEN_B_ID}`;
      expect(rows[0]!.name).toBe('Token B');
    });
  });

  describe('cross-org suite/test/artifact isolation', () => {
    it('org A context → suites with org B organization_id are invisible', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM suites WHERE id IN (${SUITE_A_ID}, ${SUITE_B_ID})`;
      });

      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(SUITE_A_ID);
    });

    it('org A context → tests with org B organization_id are invisible', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM tests WHERE id IN (${TEST_A_ID}, ${TEST_B_ID})`;
      });

      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(TEST_A_ID);
    });

    it('org A context → artifacts with org B organization_id are invisible', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM artifacts WHERE id IN (${ARTIFACT_A_ID}, ${ARTIFACT_B_ID})`;
      });

      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(ARTIFACT_A_ID);
    });

    it('org B context → org A data is invisible across all tables', async () => {
      const results = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_B_ID}, true)`;

        const suites = await tx`SELECT id FROM suites WHERE id = ${SUITE_A_ID}`;
        const tests = await tx`SELECT id FROM tests WHERE id = ${TEST_A_ID}`;
        const artifacts = await tx`SELECT id FROM artifacts WHERE id = ${ARTIFACT_A_ID}`;
        const projects = await tx`SELECT id FROM projects WHERE id = ${PROJECT_A_ID}`;

        return { suites, tests, artifacts, projects };
      });

      expect(results.suites.length).toBe(0);
      expect(results.tests.length).toBe(0);
      expect(results.artifacts.length).toBe(0);
      expect(results.projects.length).toBe(0);
    });
  });
});
