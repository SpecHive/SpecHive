/**
 * End-to-end event flow integration test.
 *
 * Verifies the full ingest pipeline: send events to the ingestion API,
 * wait for the worker to process them via Outboxy, and verify domain rows
 * exist in the database. Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 *
 * Run with:
 *   pnpm test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const INGESTION_API_URL = process.env['INGESTION_API_URL'] ?? 'http://localhost:3000';
const PROJECT_TOKEN = process.env['PROJECT_TOKEN'] ?? 'test-token';

const DATABASE_URL =
  process.env['ADMIN_DATABASE_URL'] ??
  (() => {
    const user = process.env['POSTGRES_USER'] ?? 'assertly';
    const pass = process.env['POSTGRES_PASSWORD'] ?? 'assertly';
    const db = process.env['POSTGRES_DB'] ?? 'assertly';
    return `postgres://${user}:${pass}@localhost:5432/${db}`;
  })();

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import requires value-level typeof
let postgres: typeof import('postgres').default;

async function waitForService(url: string, maxAttempts = 20, delayMs = 500): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // Service not yet ready
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Service at ${url} did not become ready within ${maxAttempts * delayMs}ms`);
}

async function waitForRow(
  sql: ReturnType<typeof postgres>,
  table: string,
  id: string,
  maxAttempts = 30,
  delayMs = 500,
): Promise<Record<string, unknown>> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rows = await sql`SELECT * FROM ${sql(table)} WHERE id = ${id}`;
    if (rows.length > 0) return rows[0] as Record<string, unknown>;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Row ${id} not found in ${table} after ${maxAttempts * delayMs}ms`);
}

async function sendEvent(
  eventType: string,
  runId: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${INGESTION_API_URL}/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-project-token': PROJECT_TOKEN,
    },
    body: JSON.stringify({
      version: '1',
      timestamp: new Date().toISOString(),
      runId,
      eventType,
      payload,
    }),
  });

  expect(response.status).toBe(202);
  return (await response.json()) as Record<string, unknown>;
}

const RUN_ID = crypto.randomUUID();
const SUITE_ID = crypto.randomUUID();
const TEST_ID = crypto.randomUUID();

describe('End-to-end event flow', () => {
  let sql: ReturnType<typeof postgres>;

  beforeAll(async () => {
    const mod = await import('postgres');
    postgres = mod.default;
    sql = postgres(DATABASE_URL, { max: 1 });

    await waitForService(INGESTION_API_URL);
  }, 30_000);

  afterAll(async () => {
    await sql.end();
  });

  it('rejects events without a project token', async () => {
    const response = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: '1',
        timestamp: new Date().toISOString(),
        runId: crypto.randomUUID(),
        eventType: 'run.start',
        payload: {},
      }),
    });

    expect(response.status).toBe(401);
  });

  it('rejects events with an invalid token', async () => {
    const response = await fetch(`${INGESTION_API_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-project-token': 'invalid-token-that-does-not-exist',
      },
      body: JSON.stringify({
        version: '1',
        timestamp: new Date().toISOString(),
        runId: crypto.randomUUID(),
        eventType: 'run.start',
        payload: {},
      }),
    });

    expect(response.status).toBe(401);
  });

  it('processes a full lifecycle: run.start -> suite.start -> test.start -> test.end -> suite.end -> run.end', async () => {
    // 1. run.start
    await sendEvent('run.start', RUN_ID, { metadata: { ci: true } });
    const run = await waitForRow(sql, 'runs', RUN_ID);
    expect(run['status']).toBe('pending');

    // 2. suite.start
    await sendEvent('suite.start', RUN_ID, {
      suiteId: SUITE_ID,
      suiteName: 'Auth Tests',
    });
    const suite = await waitForRow(sql, 'suites', SUITE_ID);
    expect(suite['name']).toBe('Auth Tests');
    expect(suite['run_id']).toBe(RUN_ID);

    // 3. test.start
    await sendEvent('test.start', RUN_ID, {
      testId: TEST_ID,
      suiteId: SUITE_ID,
      testName: 'should login successfully',
    });
    const testRow = await waitForRow(sql, 'tests', TEST_ID);
    expect(testRow['name']).toBe('should login successfully');
    expect(testRow['status']).toBe('pending');

    // 4. test.end
    await sendEvent('test.end', RUN_ID, {
      testId: TEST_ID,
      status: 'passed',
      durationMs: 150,
    });
    // Wait for the test to be updated
    let updatedTest: Record<string, unknown> | undefined;
    for (let i = 0; i < 30; i++) {
      const rows = await sql`SELECT * FROM tests WHERE id = ${TEST_ID}`;
      if (rows[0] && rows[0]['status'] === 'passed') {
        updatedTest = rows[0] as Record<string, unknown>;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(updatedTest).toBeDefined();
    expect(updatedTest!['status']).toBe('passed');
    expect(updatedTest!['duration_ms']).toBe(150);

    // 5. suite.end (no-op for DB, but still should be accepted)
    await sendEvent('suite.end', RUN_ID, { suiteId: SUITE_ID });

    // 6. run.end
    await sendEvent('run.end', RUN_ID, { status: 'passed' });
    // Wait for run to finish
    let finishedRun: Record<string, unknown> | undefined;
    for (let i = 0; i < 30; i++) {
      const rows = await sql`SELECT * FROM runs WHERE id = ${RUN_ID}`;
      if (rows[0] && rows[0]['status'] === 'passed') {
        finishedRun = rows[0] as Record<string, unknown>;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(finishedRun).toBeDefined();
    expect(finishedRun!['status']).toBe('passed');
    expect(finishedRun!['total_tests']).toBe(1);
    expect(finishedRun!['passed_tests']).toBe(1);
  }, 60_000);

  it('skips duplicate events', async () => {
    const duplicateRunId = crypto.randomUUID();

    // Send the same event twice with the same runId
    const body1 = await sendEvent('run.start', duplicateRunId, {});
    const body2 = await sendEvent('run.start', duplicateRunId, {});

    // Both should be accepted by the ingestion API (publish-only)
    expect(body1).toHaveProperty('eventId');
    expect(body2).toHaveProperty('eventId');

    // Wait for the first event to be processed
    await waitForRow(sql, 'runs', duplicateRunId);

    // Give extra time for potential duplicate processing
    await new Promise((r) => setTimeout(r, 2000));

    // Should only have one run row (deduplication prevents duplicate insert)
    const rows = await sql`SELECT * FROM runs WHERE id = ${duplicateRunId}`;
    expect(rows).toHaveLength(1);
  }, 30_000);
});
