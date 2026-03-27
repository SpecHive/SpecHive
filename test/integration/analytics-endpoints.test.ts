import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { QueryApiClient } from '../helpers/api-clients';
import {
  GATEWAY_URL,
  SEED_ORG_ID,
  SEED_PROJECT_ID,
  SEED_EMAIL,
  SEED_PASSWORD,
} from '../helpers/constants';
import { buildSuperuserDatabaseUrl, createPostgresConnection } from '../helpers/database';
import { waitForService } from '../helpers/wait';

const queryApi = new QueryApiClient(GATEWAY_URL);

// Deterministic UUIDs for analytics test data (unique prefix to avoid collisions)
const ANALYTICS_RUN_PREFIX = '01970000-aaaa-7000-8000-';

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
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;
  let jwt: string;

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());

    await waitForService(GATEWAY_URL);
    jwt = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD);

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

      await sql`
        INSERT INTO runs (id, project_id, organization_id, status, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests, started_at, finished_at, name)
        VALUES (
          ${runId(i)}, ${SEED_PROJECT_ID}, ${SEED_ORG_ID},
          'passed', ${totalTests}, ${config.passed}, ${config.failed}, ${config.skipped}, ${config.flaky},
          ${startedAt.toISOString()}, ${finishedAt.toISOString()}, ${`Analytics Test Run ${i}`}
        )
        ON CONFLICT (id) DO NOTHING
      `;

      // DB trigger requires test.run_id == suite.run_id
      await sql`
        INSERT INTO suites (id, run_id, organization_id, name)
        VALUES (${suiteId(i)}, ${runId(i)}, ${SEED_ORG_ID}, ${`Analytics Suite ${i}`})
        ON CONFLICT DO NOTHING
      `;

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
            INSERT INTO tests (id, suite_id, run_id, organization_id, name, status, duration_ms, started_at, finished_at, created_at)
            VALUES (
              ${tId}, ${suiteId(i)}, ${runId(i)}, ${SEED_ORG_ID},
              ${testName}, ${status}, ${100 + testIdx * 10},
              ${startedAt.toISOString()}, ${testFinishedAt.toISOString()}, ${startedAt.toISOString()}
            )
            ON CONFLICT (id, created_at) DO NOTHING
          `;
          testIdx++;
        }
      }

      // Analytics endpoints query stats tables, not raw runs
      const durationMs = config.durationMinutes * 60 * 1000;
      await sql`
        INSERT INTO daily_run_stats (project_id, organization_id, day,
          total_runs, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests,
          retried_tests, sum_duration_ms, min_duration_ms, max_duration_ms)
        VALUES (${SEED_PROJECT_ID}, ${SEED_ORG_ID},
          date_trunc('day', ${startedAt.toISOString()}::timestamptz AT TIME ZONE 'UTC')::date,
          1, ${totalTests}, ${config.passed}, ${config.failed}, ${config.skipped}, ${config.flaky},
          0, ${durationMs}, ${durationMs}, ${durationMs})
        ON CONFLICT (project_id, day) DO UPDATE SET
          total_runs = daily_run_stats.total_runs + 1,
          total_tests = daily_run_stats.total_tests + EXCLUDED.total_tests,
          passed_tests = daily_run_stats.passed_tests + EXCLUDED.passed_tests,
          failed_tests = daily_run_stats.failed_tests + EXCLUDED.failed_tests,
          skipped_tests = daily_run_stats.skipped_tests + EXCLUDED.skipped_tests,
          flaky_tests = daily_run_stats.flaky_tests + EXCLUDED.flaky_tests,
          sum_duration_ms = daily_run_stats.sum_duration_ms + EXCLUDED.sum_duration_ms,
          min_duration_ms = LEAST(daily_run_stats.min_duration_ms, EXCLUDED.min_duration_ms),
          max_duration_ms = GREATEST(daily_run_stats.max_duration_ms, EXCLUDED.max_duration_ms)
      `;

      for (let j = 0; j < config.flaky; j++) {
        await sql`
          INSERT INTO daily_flaky_test_stats (project_id, organization_id, test_name, day,
            flaky_count, total_count, total_retries)
          VALUES (${SEED_PROJECT_ID}, ${SEED_ORG_ID}, ${`flaky-test-${j}`},
            date_trunc('day', ${startedAt.toISOString()}::timestamptz AT TIME ZONE 'UTC')::date,
            1, 1, 0)
          ON CONFLICT (project_id, test_name, day) DO UPDATE SET
            flaky_count = daily_flaky_test_stats.flaky_count + 1,
            total_count = daily_flaky_test_stats.total_count + 1
        `;
      }
    }
  }, 30_000);

  afterAll(async () => {
    await sql`DELETE FROM daily_flaky_test_stats WHERE project_id = ${SEED_PROJECT_ID}`;
    await sql`DELETE FROM daily_run_stats WHERE project_id = ${SEED_PROJECT_ID}`;
    for (let i = 0; i < 5; i++) {
      await sql`DELETE FROM tests WHERE run_id = ${runId(i)}`;
      await sql`DELETE FROM suites WHERE id = ${suiteId(i)}`;
      await sql`DELETE FROM runs WHERE id = ${runId(i)}`;
    }
    await sql.end();
  });

  it('GET /summary returns correct aggregations', async () => {
    const { status, body } = await queryApi.analytics.summary(jwt, SEED_PROJECT_ID);

    expect(status).toBe(200);

    expect(body).toHaveProperty('totalRuns');
    expect(body).toHaveProperty('totalTests');
    expect(body).toHaveProperty('passedTests');
    expect(body).toHaveProperty('failedTests');
    expect(body).toHaveProperty('skippedTests');
    expect(body).toHaveProperty('flakyTests');
    expect(body).toHaveProperty('passRate');
    expect(body).toHaveProperty('avgDurationMs');

    const b = body as Record<string, unknown>;
    expect(b['totalRuns']).toBeGreaterThanOrEqual(5);
    expect(b['totalTests']).toBeGreaterThanOrEqual(50);
    expect(typeof b['passRate']).toBe('number');
    expect(typeof b['avgDurationMs']).toBe('number');
  });

  it('GET /pass-rate-trend returns daily buckets in ascending order', async () => {
    const { status, body } = await queryApi.analytics.passRateTrend(jwt, SEED_PROJECT_ID);

    expect(status).toBe(200);

    const items = body as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);

    for (const item of items) {
      expect(item).toHaveProperty('date');
      expect(item).toHaveProperty('passRate');
      expect(item).toHaveProperty('totalTests');
      expect(item).toHaveProperty('passedTests');
      expect(item).toHaveProperty('failedTests');
      expect(typeof item['passRate']).toBe('number');
    }

    const dates = items.map((item) => item['date'] as string);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('GET /duration-trend returns min <= avg <= max invariant', async () => {
    const { status, body } = await queryApi.analytics.durationTrend(jwt, SEED_PROJECT_ID);

    expect(status).toBe(200);

    const items = body as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);

    for (const item of items) {
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
    const { status, body } = await queryApi.analytics.flakyTests(jwt, SEED_PROJECT_ID);

    expect(status).toBe(200);

    const items = body as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(1);

    for (const item of items) {
      expect(item).toHaveProperty('testName');
      expect(item).toHaveProperty('flakyCount');
      expect(item).toHaveProperty('totalRuns');
      expect(item['flakyCount'] as number).toBeGreaterThan(0);
    }
  });

  it('returns 401 without JWT', async () => {
    const res = await queryApi.analytics.summaryRaw(SEED_PROJECT_ID);
    expect(res.status).toBe(401);
  });

  it('returns 400 with invalid projectId', async () => {
    const res = await queryApi.analytics.summaryRaw('not-a-uuid', {
      Authorization: `Bearer ${jwt}`,
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 with invalid days param', async () => {
    const { status } = await queryApi.analytics.summary(jwt, SEED_PROJECT_ID, 0);
    expect(status).toBe(400);
  });

  it('returns 400 with days exceeding max', async () => {
    const { status } = await queryApi.analytics.summary(jwt, SEED_PROJECT_ID, 91);
    expect(status).toBe(400);
  });
});
