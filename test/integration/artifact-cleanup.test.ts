/**
 * Artifact cleanup integration tests.
 *
 * Verifies the SECURITY DEFINER function `cleanup_stale_pending_artifacts()`
 * marks stale `pending://` artifacts as `failed://unretrievable` and leaves
 * fresh or already-failed artifacts untouched.
 *
 * Requires Docker Compose postgres with a migrated database:
 *   docker compose up -d postgres && pnpm db:migrate
 *
 * Run with:
 *   pnpm test:integration:db   (DB-only suite)
 *   pnpm test:integration       (full suite)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const DATABASE_URL =
  process.env['ADMIN_DATABASE_URL'] ??
  (() => {
    const user = process.env['POSTGRES_USER'] ?? 'assertly';
    const pass = process.env['POSTGRES_PASSWORD'] ?? 'assertly';
    const dbName = process.env['POSTGRES_DB'] ?? 'assertly';
    return `postgres://${user}:${pass}@localhost:5432/${dbName}`;
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

// Deterministic UUIDs with unique prefix to avoid collision with other tests
const ORG_ID = '00000000-0000-4000-c000-000000000001';
const PROJECT_ID = '00000000-0000-4000-c000-000000000002';
const RUN_ID = '00000000-0000-4000-c000-000000000003';
const SUITE_ID = '00000000-0000-4000-c000-000000000004';
const TEST_ID = '00000000-0000-4000-c000-000000000005';

// Artifact c001: stale pending (2 hours old) → should be cleaned up
const ARTIFACT_STALE_ID = '00000000-0000-4000-c000-00000000c001';
// Artifact c002: fresh pending (10 minutes old) → should NOT be cleaned up
const ARTIFACT_FRESH_ID = '00000000-0000-4000-c000-00000000c002';
// Artifact c003: already failed (2 hours old) → should NOT be cleaned up
const ARTIFACT_FAILED_ID = '00000000-0000-4000-c000-00000000c003';

describe('artifact cleanup', () => {
  let superSql: ReturnType<typeof postgres>;
  let appSql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    await loadPostgres();

    superSql = postgres(DATABASE_URL, { max: 1 });
    appSql = postgres(APP_DATABASE_URL, { max: 1 });

    await superSql`SELECT 1`;

    // Clean up any leftover test data (reverse FK order)
    await superSql`DELETE FROM artifacts WHERE id IN (${ARTIFACT_STALE_ID}, ${ARTIFACT_FRESH_ID}, ${ARTIFACT_FAILED_ID})`;
    await superSql`DELETE FROM tests WHERE id = ${TEST_ID}`;
    await superSql`DELETE FROM suites WHERE id = ${SUITE_ID}`;
    await superSql`DELETE FROM runs WHERE id = ${RUN_ID}`;
    await superSql`DELETE FROM projects WHERE id = ${PROJECT_ID}`;
    await superSql`DELETE FROM organizations WHERE id = ${ORG_ID}`;

    // Seed FK chain: org → project → run → suite → test
    await superSql`INSERT INTO organizations (id, name, slug) VALUES (${ORG_ID}, 'Cleanup Test Org', 'cleanup-test')`;
    await superSql`INSERT INTO projects (id, organization_id, name, slug) VALUES (${PROJECT_ID}, ${ORG_ID}, 'Cleanup Project', 'cleanup-proj')`;
    await superSql`
      INSERT INTO runs (id, project_id, organization_id, status, metadata, total_tests, passed_tests, failed_tests, skipped_tests)
      VALUES (${RUN_ID}, ${PROJECT_ID}, ${ORG_ID}, 'passed', '{}', 1, 1, 0, 0)
    `;
    await superSql`INSERT INTO suites (id, run_id, organization_id, name) VALUES (${SUITE_ID}, ${RUN_ID}, ${ORG_ID}, 'Cleanup Suite')`;
    await superSql`
      INSERT INTO tests (id, suite_id, run_id, organization_id, name, status, retry_count)
      VALUES (${TEST_ID}, ${SUITE_ID}, ${RUN_ID}, ${ORG_ID}, 'Cleanup Test', 'passed', 0)
    `;

    // Seed 3 artifacts with different states
    await superSql`
      INSERT INTO artifacts (id, test_id, organization_id, type, name, storage_path, created_at)
      VALUES
        (${ARTIFACT_STALE_ID}, ${TEST_ID}, ${ORG_ID}, 'screenshot', 'stale.png', 'pending://org/proj/run/test/id/stale.png', NOW() - INTERVAL '2 hours'),
        (${ARTIFACT_FRESH_ID}, ${TEST_ID}, ${ORG_ID}, 'screenshot', 'fresh.png', 'pending://org/proj/run/test/id/fresh.png', NOW() - INTERVAL '10 minutes'),
        (${ARTIFACT_FAILED_ID}, ${TEST_ID}, ${ORG_ID}, 'screenshot', 'failed.png', 'failed://unretrievable', NOW() - INTERVAL '2 hours')
    `;
  }, 30_000);

  afterAll(async () => {
    await superSql`DELETE FROM artifacts WHERE id IN (${ARTIFACT_STALE_ID}, ${ARTIFACT_FRESH_ID}, ${ARTIFACT_FAILED_ID})`;
    await superSql`DELETE FROM tests WHERE id = ${TEST_ID}`;
    await superSql`DELETE FROM suites WHERE id = ${SUITE_ID}`;
    await superSql`DELETE FROM runs WHERE id = ${RUN_ID}`;
    await superSql`DELETE FROM projects WHERE id = ${PROJECT_ID}`;
    await superSql`DELETE FROM organizations WHERE id = ${ORG_ID}`;

    await superSql.end();
    await appSql.end();
  });

  /** Calls the SECURITY DEFINER function via the app role (mirrors ArtifactCleanupService) */
  async function runCleanup(): Promise<{ artifact_id: string }[]> {
    return appSql`SELECT artifact_id FROM cleanup_stale_pending_artifacts()`;
  }

  it('marks stale pending artifacts as failed', async () => {
    const cleaned = await runCleanup();

    expect(cleaned.length).toBe(1);
    expect(cleaned[0]!.artifact_id).toBe(ARTIFACT_STALE_ID);

    const [row] =
      await superSql`SELECT storage_path FROM artifacts WHERE id = ${ARTIFACT_STALE_ID}`;
    expect(row!.storage_path).toBe('failed://unretrievable');
  });

  it('leaves fresh pending artifacts untouched', async () => {
    const [row] =
      await superSql`SELECT storage_path FROM artifacts WHERE id = ${ARTIFACT_FRESH_ID}`;
    expect(row!.storage_path).toBe('pending://org/proj/run/test/id/fresh.png');
  });

  it('leaves already-failed artifacts untouched', async () => {
    const [row] =
      await superSql`SELECT storage_path FROM artifacts WHERE id = ${ARTIFACT_FAILED_ID}`;
    expect(row!.storage_path).toBe('failed://unretrievable');
  });

  it('is idempotent on second run', async () => {
    const cleaned = await runCleanup();
    expect(cleaned.length).toBe(0);

    const [stale] =
      await superSql`SELECT storage_path FROM artifacts WHERE id = ${ARTIFACT_STALE_ID}`;
    const [fresh] =
      await superSql`SELECT storage_path FROM artifacts WHERE id = ${ARTIFACT_FRESH_ID}`;
    expect(stale!.storage_path).toBe('failed://unretrievable');
    expect(fresh!.storage_path).toBe('pending://org/proj/run/test/id/fresh.png');
  });
});
