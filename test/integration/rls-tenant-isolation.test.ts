import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import {
  buildSuperuserDatabaseUrl,
  buildAppDatabaseUrl,
  createPostgresConnection,
} from '../helpers/database';

const ORG_A_ID = '00000000-0000-4000-a000-aaaaaaaaaaaa';
const ORG_B_ID = '00000000-0000-4000-a000-bbbbbbbbbbbb';
const PROJECT_A_ID = '00000000-0000-4000-a000-aaaa00000001';
const PROJECT_B_ID = '00000000-0000-4000-a000-bbbb00000001';
const RUN_A_ID = '00000000-0000-4000-a000-aaaa00000010';
const RUN_B_ID = '00000000-0000-4000-a000-bbbb00000010';
const SUITE_A_ID = '00000000-0000-4000-a000-aaaa00000020';
const SUITE_B_ID = '00000000-0000-4000-a000-bbbb00000020';
const TEST_A_ID = '00000000-0000-4000-a000-aaaa00000030';
const TEST_B_ID = '00000000-0000-4000-a000-bbbb00000030';
const ARTIFACT_A_ID = '00000000-0000-4000-a000-aaaa00000040';
const ARTIFACT_B_ID = '00000000-0000-4000-a000-bbbb00000040';

describe('RLS tenant isolation', () => {
  let superSql: Awaited<ReturnType<typeof createPostgresConnection>>;
  let appSql: Awaited<ReturnType<typeof createPostgresConnection>>;

  beforeAll(async () => {
    superSql = await createPostgresConnection(buildSuperuserDatabaseUrl());
    appSql = await createPostgresConnection(buildAppDatabaseUrl());

    await superSql`SELECT 1`;

    await superSql`DELETE FROM artifacts WHERE id IN (${ARTIFACT_A_ID}, ${ARTIFACT_B_ID})`;
    await superSql`DELETE FROM tests WHERE id IN (${TEST_A_ID}, ${TEST_B_ID})`;
    await superSql`DELETE FROM suites WHERE id IN (${SUITE_A_ID}, ${SUITE_B_ID})`;
    await superSql`DELETE FROM runs WHERE id IN (${RUN_A_ID}, ${RUN_B_ID})`;
    await superSql`DELETE FROM projects WHERE organization_id IN (${ORG_A_ID}, ${ORG_B_ID})`;
    await superSql`DELETE FROM organizations WHERE id IN (${ORG_A_ID}, ${ORG_B_ID}) OR slug IN ('org-a', 'org-b')`;

    await superSql`
      INSERT INTO organizations (id, name, slug)
      VALUES
        (${ORG_A_ID}, 'Org A', 'org-a'),
        (${ORG_B_ID}, 'Org B', 'org-b')
    `;
    await superSql`
      INSERT INTO projects (id, organization_id, name)
      VALUES
        (${PROJECT_A_ID}, ${ORG_A_ID}, 'Project A'),
        (${PROJECT_B_ID}, ${ORG_B_ID}, 'Project B')
    `;
    await superSql`
      INSERT INTO runs (id, project_id, organization_id, status, metadata, total_tests, passed_tests, failed_tests, skipped_tests)
      VALUES
        (${RUN_A_ID}, ${PROJECT_A_ID}, ${ORG_A_ID}, 'running', '{}', 0, 0, 0, 0),
        (${RUN_B_ID}, ${PROJECT_B_ID}, ${ORG_B_ID}, 'running', '{}', 0, 0, 0, 0)
    `;
    await superSql`
      INSERT INTO suites (id, run_id, organization_id, name)
      VALUES
        (${SUITE_A_ID}, ${RUN_A_ID}, ${ORG_A_ID}, 'Suite A'),
        (${SUITE_B_ID}, ${RUN_B_ID}, ${ORG_B_ID}, 'Suite B')
    `;
    await superSql`
      INSERT INTO tests (id, suite_id, run_id, organization_id, name, status, retry_count)
      VALUES
        (${TEST_A_ID}, ${SUITE_A_ID}, ${RUN_A_ID}, ${ORG_A_ID}, 'Test A', 'passed', 0),
        (${TEST_B_ID}, ${SUITE_B_ID}, ${RUN_B_ID}, ${ORG_B_ID}, 'Test B', 'passed', 0)
    `;
    await superSql`
      INSERT INTO artifacts (id, test_id, organization_id, type, name, storage_path)
      VALUES
        (${ARTIFACT_A_ID}, ${TEST_A_ID}, ${ORG_A_ID}, 'log', 'artifact-a.log', '/artifacts/a.log'),
        (${ARTIFACT_B_ID}, ${TEST_B_ID}, ${ORG_B_ID}, 'log', 'artifact-b.log', '/artifacts/b.log')
    `;
  }, 30_000);

  afterAll(async () => {
    await superSql`DELETE FROM artifacts WHERE id IN (${ARTIFACT_A_ID}, ${ARTIFACT_B_ID})`;
    await superSql`DELETE FROM tests WHERE id IN (${TEST_A_ID}, ${TEST_B_ID})`;
    await superSql`DELETE FROM suites WHERE id IN (${SUITE_A_ID}, ${SUITE_B_ID})`;
    await superSql`DELETE FROM runs WHERE id IN (${RUN_A_ID}, ${RUN_B_ID})`;
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
    let rows: unknown[] = [];
    try {
      rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', '', true)`;
        return tx`SELECT id FROM projects`;
      });
    } catch {
      // Expected: casting '' to uuid fails, aborting the transaction (fail-closed)
    }

    expect(rows.length).toBe(0);
  });

  it('superuser role bypasses RLS', async () => {
    const rows =
      await superSql`SELECT id FROM projects WHERE id IN (${PROJECT_A_ID}, ${PROJECT_B_ID}) ORDER BY id`;

    expect(rows.length).toBe(2);
  });

  describe('runs', () => {
    it('org A context → can query org A runs', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM runs WHERE id IN (${RUN_A_ID}, ${RUN_B_ID})`;
      });

      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(RUN_A_ID);
    });

    it('org A context → org B runs return zero rows', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM runs WHERE id = ${RUN_B_ID}`;
      });

      expect(rows.length).toBe(0);
    });

    it('empty context → runs return zero rows (fail-closed)', async () => {
      let rows: unknown[] = [];
      try {
        rows = await appSql.begin(async (tx) => {
          await tx`SELECT set_config('app.current_organization_id', '', true)`;
          return tx`SELECT id FROM runs`;
        });
      } catch {
        // Expected: casting '' to uuid fails, aborting the transaction (fail-closed)
      }

      expect(rows.length).toBe(0);
    });
  });

  describe('suites', () => {
    it('org A context → can query org A suites', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM suites WHERE id IN (${SUITE_A_ID}, ${SUITE_B_ID})`;
      });

      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(SUITE_A_ID);
    });

    it('org A context → org B suites return zero rows', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM suites WHERE id = ${SUITE_B_ID}`;
      });

      expect(rows.length).toBe(0);
    });

    it('empty context → suites return zero rows (fail-closed)', async () => {
      let rows: unknown[] = [];
      try {
        rows = await appSql.begin(async (tx) => {
          await tx`SELECT set_config('app.current_organization_id', '', true)`;
          return tx`SELECT id FROM suites`;
        });
      } catch {
        // Expected: casting '' to uuid fails, aborting the transaction (fail-closed)
      }

      expect(rows.length).toBe(0);
    });
  });

  describe('tests', () => {
    it('org A context → can query org A tests', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM tests WHERE id IN (${TEST_A_ID}, ${TEST_B_ID})`;
      });

      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(TEST_A_ID);
    });

    it('org A context → org B tests return zero rows', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM tests WHERE id = ${TEST_B_ID}`;
      });

      expect(rows.length).toBe(0);
    });

    it('empty context → tests return zero rows (fail-closed)', async () => {
      let rows: unknown[] = [];
      try {
        rows = await appSql.begin(async (tx) => {
          await tx`SELECT set_config('app.current_organization_id', '', true)`;
          return tx`SELECT id FROM tests`;
        });
      } catch {
        // Expected: casting '' to uuid fails, aborting the transaction (fail-closed)
      }

      expect(rows.length).toBe(0);
    });
  });

  describe('artifacts', () => {
    it('org A context → can query org A artifacts', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM artifacts WHERE id IN (${ARTIFACT_A_ID}, ${ARTIFACT_B_ID})`;
      });

      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(ARTIFACT_A_ID);
    });

    it('org A context → org B artifacts return zero rows', async () => {
      const rows = await appSql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_organization_id', ${ORG_A_ID}, true)`;
        return tx`SELECT id FROM artifacts WHERE id = ${ARTIFACT_B_ID}`;
      });

      expect(rows.length).toBe(0);
    });

    it('empty context → artifacts return zero rows (fail-closed)', async () => {
      let rows: unknown[] = [];
      try {
        rows = await appSql.begin(async (tx) => {
          await tx`SELECT set_config('app.current_organization_id', '', true)`;
          return tx`SELECT id FROM artifacts`;
        });
      } catch {
        // Expected: casting '' to uuid fails, aborting the transaction (fail-closed)
      }

      expect(rows.length).toBe(0);
    });
  });
});
