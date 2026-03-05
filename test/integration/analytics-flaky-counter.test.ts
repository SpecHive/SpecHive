/**
 * Integration test for the flakyTests counter.
 *
 * Sends a test.end event with status 'flaky' through the ingestion pipeline
 * and verifies the run's flakyTests counter increments correctly.
 *
 * Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const INGESTION_API_URL = process.env['INGESTION_API_URL'] ?? 'http://localhost:3000';
const QUERY_API_URL = process.env['QUERY_API_URL'] ?? 'http://localhost:3002';
const TEST_IP = `10.flaky.${randomBytes(4).toString('hex')}`;
const PROJECT_TOKEN = process.env['PROJECT_TOKEN'] ?? 'test-token';

const INTEGRATION_PROJECT_ID = '01970000-0000-7000-8000-000000000002';

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

async function login(): Promise<string> {
  const response = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': TEST_IP },
    body: JSON.stringify({
      email: 'test-user@assertly.dev',
      password: 'test-password',
    }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { token: string };
  return body.token;
}

const RUN_ID = crypto.randomUUID();
const SUITE_ID = crypto.randomUUID();
const FLAKY_TEST_ID = crypto.randomUUID();
const PASSED_TEST_ID = crypto.randomUUID();

describe('Flaky tests counter', () => {
  let sql: ReturnType<typeof postgres>;
  let jwt: string;

  beforeAll(async () => {
    const mod = await import('postgres');
    postgres = mod.default;
    sql = postgres(DATABASE_URL, { max: 1 });

    await waitForService(INGESTION_API_URL);
    await waitForService(QUERY_API_URL);
    jwt = await login();
  }, 30_000);

  afterAll(async () => {
    await sql.end();
  });

  it('increments flakyTests counter on test.end with status flaky', async () => {
    // 1. Start run
    await sendEvent('run.start', RUN_ID, {});
    // Wait for run to appear in DB
    for (let i = 0; i < 30; i++) {
      const rows = await sql`SELECT * FROM runs WHERE id = ${RUN_ID}`;
      if (rows.length > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    // 2. Start suite
    await sendEvent('suite.start', RUN_ID, {
      suiteId: SUITE_ID,
      suiteName: 'Flaky Test Suite',
    });
    for (let i = 0; i < 30; i++) {
      const rows = await sql`SELECT * FROM suites WHERE id = ${SUITE_ID}`;
      if (rows.length > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    // 3. Start and end a flaky test
    await sendEvent('test.start', RUN_ID, {
      testId: FLAKY_TEST_ID,
      suiteId: SUITE_ID,
      testName: 'should handle intermittent failure',
    });
    for (let i = 0; i < 30; i++) {
      const rows = await sql`SELECT * FROM tests WHERE id = ${FLAKY_TEST_ID}`;
      if (rows.length > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    await sendEvent('test.end', RUN_ID, {
      testId: FLAKY_TEST_ID,
      status: 'flaky',
      durationMs: 200,
    });

    // 4. Start and end a passing test
    await sendEvent('test.start', RUN_ID, {
      testId: PASSED_TEST_ID,
      suiteId: SUITE_ID,
      testName: 'should pass reliably',
    });
    for (let i = 0; i < 30; i++) {
      const rows = await sql`SELECT * FROM tests WHERE id = ${PASSED_TEST_ID}`;
      if (rows.length > 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    await sendEvent('test.end', RUN_ID, {
      testId: PASSED_TEST_ID,
      status: 'passed',
      durationMs: 50,
    });

    // 5. End run
    await sendEvent('run.end', RUN_ID, { status: 'passed' });

    // Wait for run counters to update
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
    expect(finishedRun!['total_tests']).toBe(2);
    expect(finishedRun!['passed_tests']).toBe(1);
    expect(finishedRun!['flaky_tests']).toBe(1);

    // 6. Verify the query API exposes flakyTests
    const listRes = await fetch(`${QUERY_API_URL}/v1/runs?projectId=${INTEGRATION_PROJECT_ID}`, {
      headers: { Authorization: `Bearer ${jwt}`, 'X-Forwarded-For': TEST_IP },
    });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: Array<Record<string, unknown>> };
    const matchingRun = listBody.data.find((r) => r['id'] === RUN_ID);
    expect(matchingRun).toBeDefined();
    expect(matchingRun).toHaveProperty('flakyTests');
    expect(typeof matchingRun!['flakyTests']).toBe('number');

    // 7. Verify run detail also includes flakyTests
    const detailRes = await fetch(`${QUERY_API_URL}/v1/runs/${RUN_ID}`, {
      headers: { Authorization: `Bearer ${jwt}`, 'X-Forwarded-For': TEST_IP },
    });
    expect(detailRes.status).toBe(200);
    const detailBody = (await detailRes.json()) as Record<string, unknown>;
    expect(detailBody['flakyTests']).toBe(1);
  }, 60_000);
});
