/**
 * Cross-tenant analytics isolation integration test (FIX-009).
 *
 * Verifies RLS policies prevent one organization from accessing
 * another organization's analytics data through the query-api.
 */

import { randomBytes } from 'node:crypto';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const QUERY_API_URL = process.env['QUERY_API_URL'] ?? 'http://localhost:3002';

const DATABASE_URL =
  process.env['ADMIN_DATABASE_URL'] ??
  (() => {
    const user = process.env['POSTGRES_USER'] ?? 'assertly';
    const pass = process.env['POSTGRES_PASSWORD'] ?? 'assertly';
    const db = process.env['POSTGRES_DB'] ?? 'assertly';
    return `postgres://${user}:${pass}@localhost:5432/${db}`;
  })();

// Org A seeded by globalSetup
const ORG_A_ID = '01970000-0000-7000-8000-000000000001';
const ORG_A_PROJECT_ID = '01970000-0000-7000-8000-000000000002';

// Org B seeded by globalSetup
const ORG_B_ID = '01970000-0000-7000-8000-000000000006';

// Deterministic IDs for Org B test data (prefix avoids collisions)
const ORG_B_PROJECT_ID = '01970000-cccc-7000-8000-000000000001';
const ORG_B_RUN_ID = '01970000-cccc-7000-8000-000000000002';
const ORG_B_SUITE_ID = '01970000-cccc-7000-8000-000000000003';
const ORG_B_TEST_ID = '01970000-cccc-7000-8000-000000000004';

const TEST_USER_EMAIL = 'test-user@assertly.dev';
const TEST_USER_PASSWORD = 'test-password';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dynamic import
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

async function loginAs(organizationId: string): Promise<string> {
  const res = await fetch(`${QUERY_API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `10.tenant.${randomBytes(4).toString('hex')}`,
    },
    body: JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      organizationId,
    }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { token: string };
  return body.token;
}

describe('Cross-tenant analytics isolation', () => {
  let sql: ReturnType<typeof postgres>;
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const mod = await import('postgres');
    postgres = mod.default;
    sql = postgres(DATABASE_URL, { max: 1 });

    await waitForService(QUERY_API_URL);

    // Seed Org B project + run + suite + test
    await sql`
      INSERT INTO projects (id, organization_id, name, created_at, updated_at)
      VALUES (${ORG_B_PROJECT_ID}, ${ORG_B_ID}, 'Org B Project', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO runs (id, project_id, organization_id, status, created_at, updated_at,
                        started_at, finished_at,
                        total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests)
      VALUES (${ORG_B_RUN_ID}, ${ORG_B_PROJECT_ID}, ${ORG_B_ID}, 'passed', NOW(), NOW(),
              NOW(), NOW(),
              1, 1, 0, 0, 0)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO suites (id, run_id, organization_id, name, created_at, updated_at)
      VALUES (${ORG_B_SUITE_ID}, ${ORG_B_RUN_ID}, ${ORG_B_ID}, 'Isolation Suite', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO tests (id, suite_id, run_id, organization_id, name, status, duration_ms, created_at, updated_at)
      VALUES (${ORG_B_TEST_ID}, ${ORG_B_SUITE_ID}, ${ORG_B_RUN_ID}, ${ORG_B_ID}, 'isolation test', 'passed', 100, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    tokenA = await loginAs(ORG_A_ID);
    tokenB = await loginAs(ORG_B_ID);
  }, 30_000);

  afterAll(async () => {
    // Delete Org B test data in reverse FK order
    await sql`DELETE FROM tests WHERE id = ${ORG_B_TEST_ID}`;
    await sql`DELETE FROM suites WHERE id = ${ORG_B_SUITE_ID}`;
    await sql`DELETE FROM runs WHERE id = ${ORG_B_RUN_ID}`;
    await sql`DELETE FROM projects WHERE id = ${ORG_B_PROJECT_ID}`;
    await sql.end();
  });

  const FETCH_IP = `10.tenant.fetch.${randomBytes(4).toString('hex')}`;

  async function fetchSummary(token: string, projectId: string) {
    const res = await fetch(`${QUERY_API_URL}/v1/projects/${projectId}/analytics/summary`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': FETCH_IP },
    });
    return {
      status: res.status,
      body: (await res.json()) as { totalRuns: number; totalTests: number },
    };
  }

  it('tokenA can access Org A project analytics', async () => {
    const { status, body } = await fetchSummary(tokenA, ORG_A_PROJECT_ID);
    expect(status).toBe(200);
    expect(body.totalRuns).toBeGreaterThanOrEqual(0);
  });

  it('tokenB cannot access Org A project analytics (RLS blocks)', async () => {
    const { status, body } = await fetchSummary(tokenB, ORG_A_PROJECT_ID);
    expect(status).toBe(200);
    expect(body.totalRuns).toBe(0);
    expect(body.totalTests).toBe(0);
  });

  it('tokenB can access Org B project analytics', async () => {
    const { status, body } = await fetchSummary(tokenB, ORG_B_PROJECT_ID);
    expect(status).toBe(200);
    expect(body.totalRuns).toBeGreaterThanOrEqual(1);
  });

  it('tokenA cannot access Org B project analytics (RLS blocks)', async () => {
    const { status, body } = await fetchSummary(tokenA, ORG_B_PROJECT_ID);
    expect(status).toBe(200);
    expect(body.totalRuns).toBe(0);
  });
}, 60_000);
