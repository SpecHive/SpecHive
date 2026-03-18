/**
 * Integration tests for the organization-level analytics API endpoints.
 *
 * Seeds known analytics data for 2 projects via direct DB inserts, then
 * verifies the org-level endpoints return correct cross-project aggregations.
 *
 * Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { QueryApiClient } from '../helpers/api-clients';
import {
  GATEWAY_URL,
  SEED_ORG_ID,
  SEED_ORG2_ID,
  SEED_PROJECT_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
} from '../helpers/constants';
import { buildSuperuserDatabaseUrl, createPostgresConnection } from '../helpers/database';
import { waitForService } from '../helpers/wait';

const queryApi = new QueryApiClient(GATEWAY_URL);

// Deterministic UUIDs (prefix dddd to avoid collisions with aaaa/cccc)
const PROJECT_B_ID = '01970000-dddd-7000-8000-000000000001';
const PROJECT_B_NAME = 'Org Analytics Test Project B';

describe('Organization analytics endpoints', () => {
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;
  let jwt: string;

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());
    await waitForService(GATEWAY_URL);
    jwt = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
    });

    // Create Project B in the same org as the seed project
    await sql`
      INSERT INTO projects (id, organization_id, name, created_at, updated_at)
      VALUES (${PROJECT_B_ID}, ${SEED_ORG_ID}, ${PROJECT_B_NAME}, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

    const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
    const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

    const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().slice(0, 10);

    // --- Seed daily_run_stats ---

    // Project A today: 10 runs, 100 tests (90p/8f/0s/2fl), sumDur=10000, min=800, max=1200
    await sql`
      INSERT INTO daily_run_stats (project_id, organization_id, day,
        total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
        retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms)
      VALUES (${SEED_PROJECT_ID}, ${SEED_ORG_ID}, ${todayStr}::date,
        10, 100, 90, 8, 0, 2, 2, 10000, 800, 1200)
      ON CONFLICT (project_id, day) DO UPDATE SET
        total_runs = 10, total_tests = 100, passed_tests = 90, failed_tests = 8,
        skipped_tests = 0, flaky_tests = 2, retried_tests = 2,
        sum_duration_ms = 10000, min_duration_ms = 800, max_duration_ms = 1200
    `;

    // Project B today: 5 runs, 50 tests (40p/5f/0s/5fl), sumDur=10000, min=1500, max=2500
    await sql`
      INSERT INTO daily_run_stats (project_id, organization_id, day,
        total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
        retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms)
      VALUES (${PROJECT_B_ID}, ${SEED_ORG_ID}, ${todayStr}::date,
        5, 50, 40, 5, 0, 5, 3, 10000, 1500, 2500)
      ON CONFLICT (project_id, day) DO UPDATE SET
        total_runs = 5, total_tests = 50, passed_tests = 40, failed_tests = 5,
        skipped_tests = 0, flaky_tests = 5, retried_tests = 3,
        sum_duration_ms = 10000, min_duration_ms = 1500, max_duration_ms = 2500
    `;

    // Project A 2 days ago: 8 runs, 80 tests (70p/8f/0s/2fl)
    await sql`
      INSERT INTO daily_run_stats (project_id, organization_id, day,
        total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
        retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms)
      VALUES (${SEED_PROJECT_ID}, ${SEED_ORG_ID}, ${twoDaysAgoStr}::date,
        8, 80, 70, 8, 0, 2, 1, 8000, 900, 1100)
      ON CONFLICT (project_id, day) DO UPDATE SET
        total_runs = 8, total_tests = 80, passed_tests = 70, failed_tests = 8,
        skipped_tests = 0, flaky_tests = 2, retried_tests = 1,
        sum_duration_ms = 8000, min_duration_ms = 900, max_duration_ms = 1100
    `;

    // Project B 2 days ago: 3 runs, 30 tests (25p/3f/0s/2fl)
    await sql`
      INSERT INTO daily_run_stats (project_id, organization_id, day,
        total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
        retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms)
      VALUES (${PROJECT_B_ID}, ${SEED_ORG_ID}, ${twoDaysAgoStr}::date,
        3, 30, 25, 3, 0, 2, 1, 6000, 1600, 2400)
      ON CONFLICT (project_id, day) DO UPDATE SET
        total_runs = 3, total_tests = 30, passed_tests = 25, failed_tests = 3,
        skipped_tests = 0, flaky_tests = 2, retried_tests = 1,
        sum_duration_ms = 6000, min_duration_ms = 1600, max_duration_ms = 2400
    `;

    // Project A 60 days ago (for days filter test): 2 runs, 20 tests
    await sql`
      INSERT INTO daily_run_stats (project_id, organization_id, day,
        total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
        retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms)
      VALUES (${SEED_PROJECT_ID}, ${SEED_ORG_ID}, ${sixtyDaysAgoStr}::date,
        2, 20, 18, 2, 0, 0, 0, 2000, 900, 1100)
      ON CONFLICT (project_id, day) DO UPDATE SET
        total_runs = 2, total_tests = 20, passed_tests = 18, failed_tests = 2,
        skipped_tests = 0, flaky_tests = 0, retried_tests = 0,
        sum_duration_ms = 2000, min_duration_ms = 900, max_duration_ms = 1100
    `;

    // --- Seed daily_flaky_test_stats ---

    // Project A: "Login test" flakyCount=2, totalCount=10, totalRetries=4
    await sql`
      INSERT INTO daily_flaky_test_stats (project_id, organization_id, test_name, day,
        flaky_count, total_count, total_retries)
      VALUES (${SEED_PROJECT_ID}, ${SEED_ORG_ID}, 'Login test', ${todayStr}::date,
        2, 10, 4)
      ON CONFLICT (project_id, test_name, day) DO UPDATE SET
        flaky_count = 2, total_count = 10, total_retries = 4
    `;

    // Project B: "Checkout test" flakyCount=3, totalCount=5, totalRetries=6
    await sql`
      INSERT INTO daily_flaky_test_stats (project_id, organization_id, test_name, day,
        flaky_count, total_count, total_retries)
      VALUES (${PROJECT_B_ID}, ${SEED_ORG_ID}, 'Checkout test', ${todayStr}::date,
        3, 5, 6)
      ON CONFLICT (project_id, test_name, day) DO UPDATE SET
        flaky_count = 3, total_count = 5, total_retries = 6
    `;
  }, 30_000);

  afterAll(async () => {
    await sql`DELETE FROM daily_flaky_test_stats WHERE project_id IN (${SEED_PROJECT_ID}, ${PROJECT_B_ID})`;
    await sql`DELETE FROM daily_run_stats WHERE project_id IN (${SEED_PROJECT_ID}, ${PROJECT_B_ID})`;
    await sql`DELETE FROM projects WHERE id = ${PROJECT_B_ID}`;
    await sql.end();
  });

  // --- Summary ---

  it('returns org-level summary aggregated across all projects', async () => {
    const { status, body } = await queryApi.analytics.orgSummary(jwt);

    expect(status).toBe(200);

    const b = body as Record<string, unknown>;

    // Today + 2 days ago totals: runs=10+5+8+3=26, tests=100+50+80+30=260
    expect(b['totalRuns']).toBeGreaterThanOrEqual(26);
    expect(b['totalRuns']).toBeLessThan(200);
    expect(b['totalTests']).toBeGreaterThanOrEqual(260);
    expect(b['totalTests']).toBeLessThan(2000);
    expect(b['passedTests']).toBeGreaterThanOrEqual(225); // 90+40+70+25
    expect(b['passedTests']).toBeLessThan(1500);
    expect(b['failedTests']).toBeGreaterThanOrEqual(24); // 8+5+8+3
    expect(b['failedTests']).toBeLessThan(500);
    expect(b['flakyTests']).toBeGreaterThanOrEqual(11); // 2+5+2+2
    expect(b['flakyTests']).toBeLessThan(500);
    expect(b['projectCount']).toBeGreaterThanOrEqual(2);

    // Weighted pass rate: 225/260 * 100 = 86.54
    expect(b['passRate']).toBeGreaterThan(80);
    expect(b['passRate']).toBeLessThan(95);
    expect(typeof b['avgDurationMs']).toBe('number');
  });

  // --- Pass rate trend ---

  it('returns org-level pass rate trend grouped by day', async () => {
    const { status, body } = await queryApi.analytics.orgPassRateTrend(jwt, 7);

    expect(status).toBe(200);

    const items = body as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2); // today + 2 days ago

    for (const item of items) {
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('passRate');
      expect(item).toHaveProperty('totalTests');
      expect(item).toHaveProperty('passedTests');
      expect(item).toHaveProperty('failedTests');
      expect(typeof item['passRate']).toBe('number');
    }

    // Ascending date order
    const dates = items.map((item) => item['date'] as string);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);

    // Today's point should combine both projects: totalTests >= 150
    const todayPoint = items[items.length - 1]!;
    expect(todayPoint['totalTests'] as number).toBeGreaterThanOrEqual(150);
  });

  // --- Duration trend ---

  it('returns org-level duration trend with correct weighted average', async () => {
    const { status, body } = await queryApi.analytics.orgDurationTrend(jwt, 7);

    expect(status).toBe(200);

    const items = body as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);

    // Today: sumDuration=20000, totalRuns=15 → weighted avg = 1333.33
    const todayPoint = items[items.length - 1]!;
    const avgMs = todayPoint['avgDurationMs'] as number;
    // Weighted average should be ~1333, not 1500 (simple average of 1000 and 2000)
    expect(avgMs).toBeGreaterThan(1200);
    expect(avgMs).toBeLessThan(1500);

    // Min/max across projects: min=800, max=2500
    expect(todayPoint['minDurationMs']).toBe(800);
    expect(todayPoint['maxDurationMs']).toBe(2500);
  });

  // --- Flaky tests ---

  it('returns org-level flaky tests across projects with project info', async () => {
    const { status, body } = await queryApi.analytics.orgFlakyTests(jwt);

    expect(status).toBe(200);

    const items = body as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);

    for (const item of items) {
      expect(item).toHaveProperty('testName');
      expect(item).toHaveProperty('flakyCount');
      expect(item).toHaveProperty('totalRuns');
      expect(item).toHaveProperty('projectId');
      expect(item).toHaveProperty('projectName');
      expect(typeof item['projectId']).toBe('string');
      expect(typeof item['projectName']).toBe('string');
    }

    const testNames = items.map((item) => item['testName'] as string);
    expect(testNames).toContain('Checkout test');
    expect(testNames).toContain('Login test');

    // Ordered by flaky rate DESC: Checkout (3/5=60%) before Login (2/10=20%)
    const checkoutIdx = testNames.indexOf('Checkout test');
    const loginIdx = testNames.indexOf('Login test');
    expect(checkoutIdx).toBeLessThan(loginIdx);
  });

  // --- Project comparison ---

  it('returns project comparison with per-project breakdown', async () => {
    const { status, body } = await queryApi.analytics.orgProjectComparison(jwt);

    expect(status).toBe(200);

    const items = body as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(2);

    for (const item of items) {
      expect(item).toHaveProperty('projectId');
      expect(item).toHaveProperty('projectName');
      expect(item).toHaveProperty('totalRuns');
      expect(item).toHaveProperty('totalTests');
      expect(item).toHaveProperty('passRate');
      expect(item).toHaveProperty('avgDurationMs');
    }

    // Find our test projects
    const projA = items.find((i) => i['projectId'] === SEED_PROJECT_ID);
    const projB = items.find((i) => i['projectId'] === PROJECT_B_ID);
    expect(projA).toBeDefined();
    expect(projB).toBeDefined();

    // Project A has more runs (18 total) than Project B (8 total)
    expect(projA!['totalRuns'] as number).toBeGreaterThanOrEqual(18);
    expect(projB!['totalRuns'] as number).toBeGreaterThanOrEqual(8);

    // Ordered by totalRuns DESC → Project A first
    const projAIdx = items.findIndex((i) => i['projectId'] === SEED_PROJECT_ID);
    const projBIdx = items.findIndex((i) => i['projectId'] === PROJECT_B_ID);
    expect(projAIdx).toBeLessThan(projBIdx);
  });

  // --- Days parameter ---

  it('respects days parameter', async () => {
    // days=7 should exclude the 60-day-old row
    const { body: recent } = await queryApi.analytics.orgSummary(jwt, 7);
    // days=90 should include the 60-day-old row
    const { body: wide } = await queryApi.analytics.orgSummary(jwt, 90);

    const recentRuns = (recent as Record<string, unknown>)['totalRuns'] as number;
    const wideRuns = (wide as Record<string, unknown>)['totalRuns'] as number;

    // The 60-day-old row adds 2 runs, so wide should have more
    expect(wideRuns).toBeGreaterThan(recentRuns);
  });

  // --- Empty org ---

  it('returns zeros for org with no analytics data', async () => {
    const tokenB = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG2_ID,
    });

    const { status, body } = await queryApi.analytics.orgSummary(tokenB);

    expect(status).toBe(200);

    const b = body as Record<string, unknown>;
    expect(b['totalRuns']).toBe(0);
    expect(b['totalTests']).toBe(0);
    expect(b['projectCount']).toBe(0);
  });

  // --- Error cases ---

  it('returns 401 without JWT', async () => {
    const res = await queryApi.analytics.orgSummaryRaw();
    expect(res.status).toBe(401);
  });

  it('returns 400 with invalid days param', async () => {
    const { status } = await queryApi.analytics.orgSummary(jwt, 0);
    expect(status).toBe(400);
  });

  it('returns 400 with days exceeding max', async () => {
    const { status } = await queryApi.analytics.orgSummary(jwt, 91);
    expect(status).toBe(400);
  });
});
