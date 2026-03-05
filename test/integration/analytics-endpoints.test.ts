/**
 * Integration tests for the analytics API endpoints.
 *
 * Seeds known run/test data via direct DB, then verifies the analytics
 * endpoints return correct aggregations.
 *
 * Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const QUERY_API_URL = process.env['QUERY_API_URL'] ?? 'http://localhost:3002';
const TEST_IP = `10.analytics.ep.${randomBytes(4).toString('hex')}`;

const DATABASE_URL =
  process.env['ADMIN_DATABASE_URL'] ??
  (() => {
    const user = process.env['POSTGRES_USER'] ?? 'assertly';
    const pass = process.env['POSTGRES_PASSWORD'] ?? 'assertly';
    const db = process.env['POSTGRES_DB'] ?? 'assertly';
    return `postgres://${user}:${pass}@localhost:5432/${db}`;
  })();

const INTEGRATION_ORG_ID = '01970000-0000-7000-8000-000000000001';
const INTEGRATION_PROJECT_ID = '01970000-0000-7000-8000-000000000002';

// Deterministic UUIDs for analytics test data (unique prefix to avoid collisions)
const ANALYTICS_RUN_PREFIX = '01970000-aaaa-7000-8000-';

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

async function login(): Promise<string> {
  const response = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `10.analytics.${randomBytes(4).toString('hex')}`,
    },
    body: JSON.stringify({
      email: 'test-user@assertly.dev',
      password: 'test-password',
    }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { token: string };
  return body.token;
}

function runId(index: number): string {
  return `${ANALYTICS_RUN_PREFIX}${String(index).padStart(12, '0')}`;
}

function suiteId(runIndex: number): string {
  return `${ANALYTICS_RUN_PREFIX}${String(runIndex).padStart(6, '0')}ffffff`;
}

function testId(runIndex: number, testIndex: number): string {
  return `${ANALYTICS_RUN_PREFIX}${String(runIndex).padStart(6, '0')}${String(testIndex).padStart(6, '0')}`;
}

describe('Analytics endpoints', () => {
  let sql: ReturnType<typeof postgres>;
  let jwt: string;

  beforeAll(async () => {
    const mod = await import('postgres');
    postgres = mod.default;
    sql = postgres(DATABASE_URL, { max: 1 });

    await waitForService(QUERY_API_URL);
    jwt = await login();

    // Seed analytics test data: 5 runs across 10 days
    // Each run has 10 tests with known status distributions
    const now = new Date();
    const runConfigs = [
      { dayOffset: 2, passed: 8, failed: 1, skipped: 0, flaky: 1, durationMinutes: 5 },
      { dayOffset: 4, passed: 7, failed: 2, skipped: 1, flaky: 0, durationMinutes: 3 },
      { dayOffset: 6, passed: 9, failed: 0, skipped: 0, flaky: 1, durationMinutes: 8 },
      { dayOffset: 8, passed: 6, failed: 3, skipped: 0, flaky: 1, durationMinutes: 2 },
      { dayOffset: 10, passed: 10, failed: 0, skipped: 0, flaky: 0, durationMinutes: 4 },
    ];

    for (let i = 0; i < runConfigs.length; i++) {
      const config = runConfigs[i]!;
      const startedAt = new Date(now.getTime() - config.dayOffset * 24 * 60 * 60 * 1000);
      const finishedAt = new Date(startedAt.getTime() + config.durationMinutes * 60 * 1000);
      const totalTests = config.passed + config.failed + config.skipped + config.flaky;

      // Create run
      await sql`
        INSERT INTO runs (id, project_id, organization_id, status, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests, started_at, finished_at, name)
        VALUES (
          ${runId(i)}, ${INTEGRATION_PROJECT_ID}, ${INTEGRATION_ORG_ID},
          'passed', ${totalTests}, ${config.passed}, ${config.failed}, ${config.skipped}, ${config.flaky},
          ${startedAt.toISOString()}, ${finishedAt.toISOString()}, ${`Analytics Test Run ${i}`}
        )
        ON CONFLICT (id) DO NOTHING
      `;

      // Create a suite per run (DB trigger requires test.run_id == suite.run_id)
      await sql`
        INSERT INTO suites (id, run_id, organization_id, name)
        VALUES (${suiteId(i)}, ${runId(i)}, ${INTEGRATION_ORG_ID}, ${`Analytics Suite ${i}`})
        ON CONFLICT DO NOTHING
      `;

      // Seed test rows
      let testIdx = 0;
      for (const [status, count] of Object.entries({
        passed: config.passed,
        failed: config.failed,
        skipped: config.skipped,
        flaky: config.flaky,
      })) {
        for (let j = 0; j < count; j++) {
          const tId = testId(i, testIdx);
          const testFinishedAt = new Date(startedAt.getTime() + 1000);

          const testName = status === 'flaky' ? `flaky-test-${j}` : `test-${status}-${testIdx}`;

          await sql`
            INSERT INTO tests (id, suite_id, run_id, organization_id, name, status, duration_ms, started_at, finished_at)
            VALUES (
              ${tId}, ${suiteId(i)}, ${runId(i)}, ${INTEGRATION_ORG_ID},
              ${testName}, ${status}, ${100 + testIdx * 10},
              ${startedAt.toISOString()}, ${testFinishedAt.toISOString()}
            )
            ON CONFLICT (id) DO NOTHING
          `;
          testIdx++;
        }
      }
    }
  }, 30_000);

  afterAll(async () => {
    // Clean up seeded data in reverse dependency order
    for (let i = 0; i < 5; i++) {
      await sql`DELETE FROM tests WHERE run_id = ${runId(i)}`;
      await sql`DELETE FROM suites WHERE id = ${suiteId(i)}`;
      await sql`DELETE FROM runs WHERE id = ${runId(i)}`;
    }
    await sql.end();
  });

  it('GET /summary returns correct aggregations', async () => {
    const res = await fetch(
      `${QUERY_API_URL}/v1/projects/${INTEGRATION_PROJECT_ID}/analytics/summary?days=30`,
      { headers: { Authorization: `Bearer ${jwt}`, 'X-Forwarded-For': TEST_IP } },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(body).toHaveProperty('totalRuns');
    expect(body).toHaveProperty('totalTests');
    expect(body).toHaveProperty('passedTests');
    expect(body).toHaveProperty('failedTests');
    expect(body).toHaveProperty('skippedTests');
    expect(body).toHaveProperty('flakyTests');
    expect(body).toHaveProperty('passRate');
    expect(body).toHaveProperty('avgDurationMs');

    // We seeded 5 runs with a total of 50 tests
    expect(body['totalRuns']).toBeGreaterThanOrEqual(5);
    expect(body['totalTests']).toBeGreaterThanOrEqual(50);
    expect(typeof body['passRate']).toBe('number');
    expect(typeof body['avgDurationMs']).toBe('number');
  });

  it('GET /pass-rate-trend returns daily buckets in ascending order', async () => {
    const res = await fetch(
      `${QUERY_API_URL}/v1/projects/${INTEGRATION_PROJECT_ID}/analytics/pass-rate-trend?days=30`,
      { headers: { Authorization: `Bearer ${jwt}`, 'X-Forwarded-For': TEST_IP } },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    for (const item of body) {
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('passRate');
      expect(item).toHaveProperty('totalTests');
      expect(item).toHaveProperty('passedTests');
      expect(item).toHaveProperty('failedTests');
      expect(typeof item['passRate']).toBe('number');
    }

    // Verify ascending date order
    const dates = body.map((item) => item['date'] as string);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('GET /duration-trend returns min <= avg <= max invariant', async () => {
    const res = await fetch(
      `${QUERY_API_URL}/v1/projects/${INTEGRATION_PROJECT_ID}/analytics/duration-trend?days=30`,
      { headers: { Authorization: `Bearer ${jwt}`, 'X-Forwarded-For': TEST_IP } },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;

    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    for (const item of body) {
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('avgDurationMs');
      expect(item).toHaveProperty('minDurationMs');
      expect(item).toHaveProperty('maxDurationMs');

      const min = item['minDurationMs'] as number;
      const avg = item['avgDurationMs'] as number;
      const max = item['maxDurationMs'] as number;
      expect(min).toBeLessThanOrEqual(avg);
      expect(avg).toBeLessThanOrEqual(max);
    }
  });

  it('GET /flaky-tests returns flaky test names', async () => {
    const res = await fetch(
      `${QUERY_API_URL}/v1/projects/${INTEGRATION_PROJECT_ID}/analytics/flaky-tests?days=30&limit=10`,
      { headers: { Authorization: `Bearer ${jwt}`, 'X-Forwarded-For': TEST_IP } },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;

    expect(Array.isArray(body)).toBe(true);
    // We seeded 3 runs with flaky tests (runs 0, 2, 3 each have 1 flaky)
    expect(body.length).toBeGreaterThanOrEqual(1);

    for (const item of body) {
      expect(item).toHaveProperty('testName');
      expect(item).toHaveProperty('flakyCount');
      expect(item).toHaveProperty('totalRuns');
      expect(item['flakyCount'] as number).toBeGreaterThan(0);
    }
  });

  it('returns 401 without JWT', async () => {
    const res = await fetch(
      `${QUERY_API_URL}/v1/projects/${INTEGRATION_PROJECT_ID}/analytics/summary`,
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 with invalid projectId', async () => {
    const res = await fetch(`${QUERY_API_URL}/v1/projects/not-a-uuid/analytics/summary`, {
      headers: { Authorization: `Bearer ${jwt}`, 'X-Forwarded-For': TEST_IP },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid days param', async () => {
    const res = await fetch(
      `${QUERY_API_URL}/v1/projects/${INTEGRATION_PROJECT_ID}/analytics/summary?days=0`,
      { headers: { Authorization: `Bearer ${jwt}`, 'X-Forwarded-For': TEST_IP } },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 with days exceeding max', async () => {
    const res = await fetch(
      `${QUERY_API_URL}/v1/projects/${INTEGRATION_PROJECT_ID}/analytics/summary?days=91`,
      { headers: { Authorization: `Bearer ${jwt}`, 'X-Forwarded-For': TEST_IP } },
    );
    expect(res.status).toBe(400);
  });
});
