/**
 * Cross-tenant analytics isolation integration test (FIX-009).
 *
 * Verifies RLS policies prevent one organization from accessing
 * another organization's analytics data through the query-api.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { QueryApiClient } from '../helpers/api-clients';
import {
  SEED_ORG_ID,
  SEED_PROJECT_ID,
  SEED_ORG2_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
  GATEWAY_URL,
} from '../helpers/constants';
import { buildSuperuserDatabaseUrl, createPostgresConnection } from '../helpers/database';
import { waitForService } from '../helpers/wait';

// Deterministic IDs for Org B test data (prefix avoids collisions)
const ORG_B_PROJECT_ID = '01970000-cccc-7000-8000-000000000001';
const ORG_B_RUN_ID = '01970000-cccc-7000-8000-000000000002';
const ORG_B_SUITE_ID = '01970000-cccc-7000-8000-000000000003';
const ORG_B_TEST_ID = '01970000-cccc-7000-8000-000000000004';

describe('Cross-tenant analytics isolation', () => {
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;
  let tokenA: string;
  let tokenB: string;
  const queryApi = new QueryApiClient(GATEWAY_URL);

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());

    await waitForService(GATEWAY_URL);

    // Seed Org B project + run + suite + test
    await sql`
      INSERT INTO projects (id, organization_id, name, created_at, updated_at)
      VALUES (${ORG_B_PROJECT_ID}, ${SEED_ORG2_ID}, 'Org B Project', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO runs (id, project_id, organization_id, status, created_at, updated_at,
                        started_at, finished_at,
                        total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests)
      VALUES (${ORG_B_RUN_ID}, ${ORG_B_PROJECT_ID}, ${SEED_ORG2_ID}, 'passed', NOW(), NOW(),
              NOW(), NOW(),
              1, 1, 0, 0, 0)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO suites (id, run_id, organization_id, name, created_at, updated_at)
      VALUES (${ORG_B_SUITE_ID}, ${ORG_B_RUN_ID}, ${SEED_ORG2_ID}, 'Isolation Suite', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO tests (id, suite_id, run_id, organization_id, name, status, duration_ms, created_at, updated_at)
      VALUES (${ORG_B_TEST_ID}, ${ORG_B_SUITE_ID}, ${ORG_B_RUN_ID}, ${SEED_ORG2_ID}, 'isolation test', 'passed', 100, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;

    tokenA = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG_ID,
    });
    tokenB = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD, {
      organizationId: SEED_ORG2_ID,
    });
  }, 30_000);

  afterAll(async () => {
    // Delete Org B test data in reverse FK order
    await sql`DELETE FROM tests WHERE id = ${ORG_B_TEST_ID}`;
    await sql`DELETE FROM suites WHERE id = ${ORG_B_SUITE_ID}`;
    await sql`DELETE FROM runs WHERE id = ${ORG_B_RUN_ID}`;
    await sql`DELETE FROM projects WHERE id = ${ORG_B_PROJECT_ID}`;
    await sql.end();
  });

  it('tokenA can access Org A project analytics', async () => {
    const { status, body } = await queryApi.analytics.summary(tokenA, SEED_PROJECT_ID);
    expect(status).toBe(200);
    expect(body.totalRuns).toBeGreaterThanOrEqual(0);
  });

  it('tokenB cannot access Org A project analytics (RLS blocks)', async () => {
    const { status, body } = await queryApi.analytics.summary(tokenB, SEED_PROJECT_ID);
    expect(status).toBe(200);
    expect(body.totalRuns).toBe(0);
    expect(body.totalTests).toBe(0);
  });

  it('tokenB can access Org B project analytics', async () => {
    const { status, body } = await queryApi.analytics.summary(tokenB, ORG_B_PROJECT_ID);
    expect(status).toBe(200);
    expect(body.totalRuns).toBeGreaterThanOrEqual(1);
  });

  it('tokenA cannot access Org B project analytics (RLS blocks)', async () => {
    const { status, body } = await queryApi.analytics.summary(tokenA, ORG_B_PROJECT_ID);
    expect(status).toBe(200);
    expect(body.totalRuns).toBe(0);
  });
}, 60_000);
