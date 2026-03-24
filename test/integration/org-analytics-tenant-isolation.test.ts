/**
 * Cross-tenant org-level analytics isolation integration test.
 *
 * Verifies RLS policies prevent one organization from seeing another
 * organization's data through the org-level analytics endpoints.
 *
 * Requires the full Docker Compose stack running:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { QueryApiClient } from '../helpers/api-clients';
import {
  SEED_ORG_ID,
  SEED_ORG2_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
  GATEWAY_URL,
} from '../helpers/constants';
import { buildSuperuserDatabaseUrl, createPostgresConnection } from '../helpers/database';
import { waitForService } from '../helpers/wait';

// Deterministic IDs (prefix eeee to avoid collisions with dddd in analytics-endpoints tests)
const ORG_A_PROJECT_ID = '01970000-eeee-7000-8000-000000000002';
const ORG_A_PROJECT_NAME = 'Org A Isolation Project';
const ORG_B_PROJECT_ID = '01970000-eeee-7000-8000-000000000001';
const ORG_B_PROJECT_NAME = 'Org B Isolation Project';

describe('Cross-tenant org-level analytics isolation', () => {
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;
  let tokenA: string;
  let tokenB: string;
  const queryApi = new QueryApiClient(GATEWAY_URL);

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());
    await waitForService(GATEWAY_URL);

    // Seed Org A project + analytics data (own project to avoid collision with analytics-endpoints tests)
    const today = new Date().toISOString().slice(0, 10);

    await sql`
      INSERT INTO projects (id, organization_id, name, created_at, updated_at)
      VALUES (${ORG_A_PROJECT_ID}, ${SEED_ORG_ID}, ${ORG_A_PROJECT_NAME}, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO daily_run_stats (project_id, organization_id, day,
        total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
        retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms)
      VALUES (${ORG_A_PROJECT_ID}, ${SEED_ORG_ID}, ${today}::date,
        7, 70, 60, 8, 0, 2, 1, 7000, 900, 1100)
      ON CONFLICT (project_id, day) DO UPDATE SET
        total_runs = 7, total_tests = 70, passed_tests = 60, failed_tests = 8,
        skipped_tests = 0, flaky_tests = 2, retried_tests = 1,
        sum_duration_ms = 7000, min_duration_ms = 900, max_duration_ms = 1100
    `;

    await sql`
      INSERT INTO daily_flaky_test_stats (project_id, organization_id, test_name, day,
        flaky_count, total_count, total_retries)
      VALUES (${ORG_A_PROJECT_ID}, ${SEED_ORG_ID}, 'Org A flaky test', ${today}::date,
        2, 8, 3)
      ON CONFLICT (project_id, test_name, day) DO UPDATE SET
        flaky_count = 2, total_count = 8, total_retries = 3
    `;

    // Seed Org B project + analytics data
    await sql`
      INSERT INTO projects (id, organization_id, name, created_at, updated_at)
      VALUES (${ORG_B_PROJECT_ID}, ${SEED_ORG2_ID}, ${ORG_B_PROJECT_NAME}, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO daily_run_stats (project_id, organization_id, day,
        total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
        retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms)
      VALUES (${ORG_B_PROJECT_ID}, ${SEED_ORG2_ID}, ${today}::date,
        3, 30, 25, 3, 0, 2, 1, 3000, 800, 1200)
      ON CONFLICT (project_id, day) DO UPDATE SET
        total_runs = 3, total_tests = 30, passed_tests = 25, failed_tests = 3,
        skipped_tests = 0, flaky_tests = 2, retried_tests = 1,
        sum_duration_ms = 3000, min_duration_ms = 800, max_duration_ms = 1200
    `;

    await sql`
      INSERT INTO daily_flaky_test_stats (project_id, organization_id, test_name, day,
        flaky_count, total_count, total_retries)
      VALUES (${ORG_B_PROJECT_ID}, ${SEED_ORG2_ID}, 'Org B secret test', ${today}::date,
        2, 5, 4)
      ON CONFLICT (project_id, test_name, day) DO UPDATE SET
        flaky_count = 2, total_count = 5, total_retries = 4
    `;

    tokenA = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
    });
    tokenB = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG2_ID,
    });
  }, 30_000);

  afterAll(async () => {
    await sql`DELETE FROM daily_flaky_test_stats WHERE project_id IN (${ORG_A_PROJECT_ID}, ${ORG_B_PROJECT_ID})`;
    await sql`DELETE FROM daily_run_stats WHERE project_id IN (${ORG_A_PROJECT_ID}, ${ORG_B_PROJECT_ID})`;
    await sql`DELETE FROM projects WHERE id IN (${ORG_A_PROJECT_ID}, ${ORG_B_PROJECT_ID})`;
    await sql.end();
  });

  it('org-level summary only includes current org data', async () => {
    const { status: statusA, body: bodyA } = await queryApi.analytics.orgSummary(tokenA);
    const { status: statusB, body: bodyB } = await queryApi.analytics.orgSummary(tokenB);

    expect(statusA).toBe(200);
    expect(statusB).toBe(200);

    const a = bodyA as Record<string, unknown>;
    const b = bodyB as Record<string, unknown>;

    // Org A seeded 7 runs, Org B seeded 3 runs — neither should see the other's
    expect(a['totalRuns']).toBeGreaterThanOrEqual(7);
    expect(b['totalRuns']).toBeGreaterThanOrEqual(3);

    // Org A should not include Org B's 30 tests
    expect(a['totalTests']).toBeGreaterThanOrEqual(70);
    // Org B should not include Org A's 70 tests
    expect(b['totalTests'] as number).toBeLessThanOrEqual(30);

    // Org B has exactly 1 project
    expect(b['projectCount']).toBe(1);
  });

  it('project comparison only shows current org projects', async () => {
    const { status, body } = await queryApi.analytics.orgProjectComparison(tokenA);

    expect(status).toBe(200);

    const response = body as { projects: Array<Record<string, unknown>> };
    const projectIds = response.projects.map((i) => i['projectId'] as string);

    // Should not contain Org B's project
    expect(projectIds).not.toContain(ORG_B_PROJECT_ID);
  });

  it('org-level flaky tests do not leak across orgs', async () => {
    const { status, body } = await queryApi.analytics.orgFlakyTests(tokenA);

    expect(status).toBe(200);

    const items = body as Array<Record<string, unknown>>;
    const testNames = items.map((i) => i['testName'] as string);

    // Org A should see its own flaky test, not Org B's
    expect(testNames).toContain('Org A flaky test');
    expect(testNames).not.toContain('Org B secret test');
  });

  it('org B flaky tests only show org B data', async () => {
    const { status, body } = await queryApi.analytics.orgFlakyTests(tokenB);

    expect(status).toBe(200);

    const items = body as Array<Record<string, unknown>>;
    const testNames = items.map((i) => i['testName'] as string);

    expect(testNames).toContain('Org B secret test');
    expect(testNames).not.toContain('Org A flaky test');
  });
}, 60_000);
