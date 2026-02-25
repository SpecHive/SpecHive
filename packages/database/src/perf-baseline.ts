/* eslint-disable no-console */
import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';

import { MembershipRole, RunStatus, TestStatus } from '@assertly/shared-types';
import { sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { createDbConnection, getRawClient } from './connection.js';
import { runs, suites, tests } from './schema/execution.js';
import { projects, projectTokens } from './schema/project.js';
import { organizations, users, memberships } from './schema/tenant.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUN_COUNT = 10_000;
const SUITES_PER_RUN = 5; // 10K * 5 = 50K suites
const TESTS_PER_SUITE = 4; // 50K * 4 = 200K tests
const BATCH_SIZE = 500;

const RUN_STATUSES: RunStatus[] = [
  RunStatus.Passed,
  RunStatus.Failed,
  RunStatus.Pending,
  RunStatus.Running,
];

const TEST_STATUSES: TestStatus[] = [
  TestStatus.Passed,
  TestStatus.Failed,
  TestStatus.Skipped,
  TestStatus.Pending,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExplainRow {
  'QUERY PLAN': string;
}

interface QueryResult {
  queryName: string;
  usesSeqScan: boolean;
  planLines: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insertBatched<T extends Record<string, unknown>>(
  db: ReturnType<typeof createDbConnection>,
  table: Parameters<ReturnType<typeof createDbConnection>['insert']>[0],
  rows: T[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.insert(table).values(rows.slice(i, i + BATCH_SIZE) as T[]);
  }
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function seedData(db: ReturnType<typeof createDbConnection>): Promise<{
  projectId: string;
  tokenHash: string;
  sampleRunId: string;
  sampleSuiteId: string;
  sampleFailedRunId: string;
  sampleFailedTestRunId: string;
  sampleSuiteWithFailedTestId: string;
}> {
  console.log('Seeding baseline data...');

  const [org] = await db
    .insert(organizations)
    .values({ name: 'Perf Baseline Org', slug: `perf-org-${uuidv7()}` })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      email: `perf-${uuidv7()}@baseline.test`,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+daw',
      name: 'Perf User',
    })
    .returning();

  await db.insert(memberships).values({
    organizationId: org!.id,
    userId: user!.id,
    role: MembershipRole.Owner,
  });

  const [project] = await db
    .insert(projects)
    .values({
      organizationId: org!.id,
      name: 'Perf Baseline Project',
      slug: `perf-proj-${uuidv7()}`,
    })
    .returning();

  const projectId = project!.id;

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await db.insert(projectTokens).values({
    projectId,
    name: 'Perf Token',
    tokenHash,
  });

  // Build all run rows up-front to avoid per-row async overhead
  const runRows = Array.from({ length: RUN_COUNT }, (_, i) => ({
    id: uuidv7(),
    projectId,
    status: RUN_STATUSES[i % RUN_STATUSES.length]!,
    totalTests: SUITES_PER_RUN * TESTS_PER_SUITE,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    startedAt: new Date(Date.now() - i * 60_000),
    finishedAt: new Date(Date.now() - i * 60_000 + 30_000),
  }));

  console.log(`  Inserting ${RUN_COUNT} runs...`);
  await insertBatched(db, runs, runRows);

  // Pick stable sample IDs for query assertions
  const sampleRunId = runRows[0]!.id;
  const sampleFailedRunId = runRows.find((r) => r.status === RunStatus.Failed)!.id;

  console.log(`  Inserting ${RUN_COUNT * SUITES_PER_RUN} suites...`);
  const suiteRows: { id: string; runId: string; name: string; parentSuiteId: null }[] = [];
  const firstRunSuiteIds: string[] = [];

  for (const run of runRows) {
    for (let s = 0; s < SUITES_PER_RUN; s++) {
      const suiteId = uuidv7();
      if (run.id === sampleRunId && s === 0) {
        firstRunSuiteIds.push(suiteId);
      }
      suiteRows.push({ id: suiteId, runId: run.id, name: `Suite ${s}`, parentSuiteId: null });
    }
  }

  await insertBatched(db, suites, suiteRows);

  const sampleSuiteId = firstRunSuiteIds[0]!;

  console.log(`  Inserting ${RUN_COUNT * SUITES_PER_RUN * TESTS_PER_SUITE} tests...`);
  const testRows: {
    id: string;
    suiteId: string;
    runId: string;
    name: string;
    status: TestStatus;
    durationMs: number;
  }[] = [];

  let sampleFailedTestRunId = sampleRunId;
  let sampleSuiteWithFailedTestId = sampleSuiteId;
  let foundFailedTest = false;

  for (const suite of suiteRows) {
    for (let t = 0; t < TESTS_PER_SUITE; t++) {
      const status = TEST_STATUSES[t % TEST_STATUSES.length]!;
      testRows.push({
        id: uuidv7(),
        suiteId: suite.id,
        runId: suite.runId,
        name: `Test ${t}`,
        status,
        durationMs: 10 + t * 5,
      });

      if (!foundFailedTest && status === TestStatus.Failed) {
        sampleFailedTestRunId = suite.runId;
        sampleSuiteWithFailedTestId = suite.id;
        foundFailedTest = true;
      }
    }
  }

  await insertBatched(db, tests, testRows);

  console.log('Seeding complete.\n');

  return {
    projectId,
    tokenHash,
    sampleRunId,
    sampleSuiteId,
    sampleFailedRunId,
    sampleFailedTestRunId,
    sampleSuiteWithFailedTestId,
  };
}

// ---------------------------------------------------------------------------
// EXPLAIN ANALYZE helpers
// ---------------------------------------------------------------------------

async function explainAnalyze(
  db: ReturnType<typeof createDbConnection>,
  queryName: string,
  rawSql: string,
  params: unknown[],
): Promise<QueryResult> {
  const explainSql = `EXPLAIN ANALYZE ${rawSql}`;
  // postgres-js exposes $client for raw SQL on the drizzle instance
  const client = getRawClient(db);
  const rows = (await client.unsafe(explainSql, params as string[])) as unknown as ExplainRow[];
  const planLines = rows.map((r) => r['QUERY PLAN']);
  const usesSeqScan = planLines.some((line) => line.includes('Seq Scan'));

  return { queryName, usesSeqScan, planLines };
}

// ---------------------------------------------------------------------------
// Queries under test
// ---------------------------------------------------------------------------

async function runQueries(
  db: ReturnType<typeof createDbConnection>,
  ids: {
    projectId: string;
    tokenHash: string;
    sampleRunId: string;
    sampleSuiteId: string;
    sampleFailedRunId: string;
    sampleFailedTestRunId: string;
    sampleSuiteWithFailedTestId: string;
  },
): Promise<QueryResult[]> {
  const results: QueryResult[] = [];

  results.push(
    await explainAnalyze(
      db,
      'runs_by_project_order_created',
      'SELECT * FROM runs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 20',
      [ids.projectId],
    ),
  );

  results.push(
    await explainAnalyze(
      db,
      'runs_by_project_and_status_failed',
      "SELECT * FROM runs WHERE project_id = $1 AND status = 'failed'",
      [ids.projectId],
    ),
  );

  results.push(
    await explainAnalyze(db, 'tests_by_suite_id', 'SELECT * FROM tests WHERE suite_id = $1', [
      ids.sampleSuiteId,
    ]),
  );

  results.push(
    await explainAnalyze(
      db,
      'tests_by_run_id_and_status_failed',
      "SELECT * FROM tests WHERE run_id = $1 AND status = 'failed'",
      [ids.sampleFailedTestRunId],
    ),
  );

  results.push(
    await explainAnalyze(
      db,
      'artifacts_by_test_id',
      // Artifacts table uses test_id index; use a subquery to get a real test id
      'SELECT * FROM artifacts WHERE test_id IN (SELECT id FROM tests WHERE run_id = $1 LIMIT 1)',
      [ids.sampleRunId],
    ),
  );

  results.push(
    await explainAnalyze(
      db,
      'project_tokens_by_token_hash',
      'SELECT * FROM project_tokens WHERE token_hash = $1',
      [ids.tokenHash],
    ),
  );

  return results;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanupData(
  db: ReturnType<typeof createDbConnection>,
  projectId: string,
): Promise<void> {
  console.log('\nCleaning up seeded data...');

  // Resolve org and user IDs before any deletes so FK lookups still work.
  const orgRows = await db.execute<{ organization_id: string }>(
    sql`SELECT organization_id FROM projects WHERE id = ${projectId}`,
  );
  const orgId: string | undefined = orgRows[0]?.organization_id;

  let memberUserIds: string[] = [];
  if (orgId) {
    const userRows = await db.execute<{ user_id: string }>(
      sql`SELECT user_id FROM memberships WHERE organization_id = ${orgId}`,
    );
    memberUserIds = Array.from(userRows).map((r) => r.user_id);
  }

  // Delete in FK-safe order (children before parents).
  await db.execute(
    sql`DELETE FROM artifacts WHERE test_id IN (SELECT t.id FROM tests t JOIN runs r ON r.id = t.run_id WHERE r.project_id = ${projectId})`,
  );
  await db.execute(
    sql`DELETE FROM tests WHERE run_id IN (SELECT id FROM runs WHERE project_id = ${projectId})`,
  );
  await db.execute(
    sql`DELETE FROM suites WHERE run_id IN (SELECT id FROM runs WHERE project_id = ${projectId})`,
  );
  await db.execute(sql`DELETE FROM runs WHERE project_id = ${projectId}`);
  await db.execute(sql`DELETE FROM project_tokens WHERE project_id = ${projectId}`);
  await db.execute(sql`DELETE FROM projects WHERE id = ${projectId}`);

  if (orgId) {
    await db.execute(sql`DELETE FROM memberships WHERE organization_id = ${orgId}`);
    for (const userId of memberUserIds) {
      await db.execute(sql`DELETE FROM users WHERE id = ${userId}`);
    }
    await db.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
  }

  console.log('Cleanup complete.');
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport(results: QueryResult[]): boolean {
  console.log('\n--- Index Scan Baseline Report ---\n');

  let allPassed = true;

  for (const result of results) {
    const status = result.usesSeqScan ? 'FAIL (Seq Scan)' : 'PASS (Index Scan)';
    const icon = result.usesSeqScan ? 'X' : 'V';
    console.log(`[${icon}] ${result.queryName}: ${status}`);

    if (result.usesSeqScan) {
      allPassed = false;
      console.log('    Plan:');
      result.planLines.slice(0, 10).forEach((line) => console.log(`      ${line}`));
    }
  }

  console.log('\n----------------------------------');
  return allPassed;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const db = createDbConnection();

  let projectId: string | undefined;

  try {
    const ids = await seedData(db);
    projectId = ids.projectId;

    const results = await runQueries(db, ids);
    const allPassed = printReport(results);

    await cleanupData(db, projectId);

    if (!allPassed) {
      console.error('\nPerformance baseline FAILED: one or more queries use Seq Scan.');
      process.exit(1);
    }

    console.log('\nPerformance baseline PASSED: all queries use Index Scan.');
    process.exit(0);
  } catch (err) {
    console.error('\nUnexpected error during perf baseline:', err);
    if (projectId) {
      try {
        await cleanupData(db, projectId);
      } catch {
        // Ignore cleanup errors in the error path
      }
    }
    process.exit(1);
  }
}

main();
