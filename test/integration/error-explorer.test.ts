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

interface ErrorGroupRow {
  id: string;
  totalOccurrences: number;
  uniqueTestCount: number;
  uniqueBranchCount: number;
  errorCategory: string | null;
  errorName: string | null;
}

interface TimelineRow {
  series: Array<{
    errorGroupId: string;
    title: string;
    dataPoints: Array<{ date: string; occurrences: number }>;
  }>;
  otherSeries: Array<{ date: string; occurrences: number }>;
}

interface PaginatedGroups {
  data: ErrorGroupRow[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

const queryApi = new QueryApiClient(GATEWAY_URL);

// ── Deterministic UUIDs ─────────────────────────────────────────
const PREFIX = '01970000-ee00-7000-8000-';
const uid = (n: number) => `${PREFIX}${String(n).padStart(12, '0')}`;

const RUN_1 = uid(1);
const RUN_2 = uid(2);
const RUN_3 = uid(3);
const SUITE_1 = uid(11);
const SUITE_2 = uid(12);
const SUITE_3 = uid(13);
const TEST_1A = uid(21);
const TEST_1B = uid(22);
const TEST_2A = uid(23);
const TEST_3A = uid(24);
const GROUP_ASSERTION = uid(31);
const GROUP_TIMEOUT = uid(32);
const OCC_1A = uid(41);
const OCC_1B = uid(42);
const OCC_2A = uid(43);
const OCC_3A = uid(44);

describe('Error Explorer endpoints', () => {
  let sql: Awaited<ReturnType<typeof createPostgresConnection>>;
  let jwt: string;

  beforeAll(async () => {
    sql = await createPostgresConnection(buildSuperuserDatabaseUrl());
    await waitForService(GATEWAY_URL);
    jwt = await queryApi.auth.loginToken(SEED_EMAIL, SEED_PASSWORD);

    // ── Seed test data ───────────────────────────────────────────
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

    // Runs (3 runs across different dates/branches)
    for (const [id, suiteUid, startOffset, branch] of [
      [RUN_1, SUITE_1, 2, 'main'],
      [RUN_2, SUITE_2, 5, 'main'],
      [RUN_3, SUITE_3, 1, 'feature/login'],
    ] as const) {
      const startedAt = daysAgo(startOffset);
      await sql`
        INSERT INTO runs (id, project_id, organization_id, status, branch, total_tests, passed_tests, failed_tests, skipped_tests, flaky_tests, started_at, finished_at)
        VALUES (${id}, ${SEED_PROJECT_ID}, ${SEED_ORG_ID}, 'passed', ${branch}, 2, 1, 1, 0, 0, ${startedAt.toISOString()}, ${new Date(startedAt.getTime() + 60_000).toISOString()})
        ON CONFLICT (id) DO NOTHING
      `;
      await sql`
        INSERT INTO suites (id, run_id, organization_id, name)
        VALUES (${suiteUid}, ${id}, ${SEED_ORG_ID}, 'Suite')
        ON CONFLICT DO NOTHING
      `;
    }

    // Tests
    for (const [testUid, suiteUid, runUid, name] of [
      [TEST_1A, SUITE_1, RUN_1, 'login page renders'],
      [TEST_1B, SUITE_1, RUN_1, 'login form submits'],
      [TEST_2A, SUITE_2, RUN_2, 'login page renders'],
      [TEST_3A, SUITE_3, RUN_3, 'dashboard loads'],
    ] as const) {
      await sql`
        INSERT INTO tests (id, suite_id, run_id, organization_id, name, status, duration_ms)
        VALUES (${testUid}, ${suiteUid}, ${runUid}, ${SEED_ORG_ID}, ${name}, 'failed', 100)
        ON CONFLICT DO NOTHING
      `;
    }

    // Error groups (2 groups: assertion + timeout)
    await sql`
      INSERT INTO error_groups (id, organization_id, project_id, fingerprint, title, normalized_message, error_name, error_category, total_occurrences, unique_test_count, unique_branch_count, first_seen_at, last_seen_at)
      VALUES
        (${GROUP_ASSERTION}, ${SEED_ORG_ID}, ${SEED_PROJECT_ID}, 'fp-assertion-login', 'Expected "Dashboard" but got "Login"', 'expected <PLACEHOLDER> but got <PLACEHOLDER>', 'AssertionError', 'assertion', 3, 2, 2, ${daysAgo(5).toISOString()}, ${daysAgo(1).toISOString()}),
        (${GROUP_TIMEOUT}, ${SEED_ORG_ID}, ${SEED_PROJECT_ID}, 'fp-timeout-nav', 'Timeout waiting for navigation', 'timeout <LINE>ms exceeded', 'TimeoutError', 'timeout', 1, 1, 1, ${daysAgo(2).toISOString()}, ${daysAgo(2).toISOString()})
      ON CONFLICT DO NOTHING
    `;

    // Error occurrences (4 total: 3 assertion + 1 timeout)
    await sql`
      INSERT INTO error_occurrences (id, organization_id, error_group_id, test_id, run_id, project_id, branch, test_name, error_message, occurred_at)
      VALUES
        (${OCC_1A}, ${SEED_ORG_ID}, ${GROUP_ASSERTION}, ${TEST_1A}, ${RUN_1}, ${SEED_PROJECT_ID}, 'main', 'login page renders', 'Expected "Dashboard" but got "Login"', ${daysAgo(2).toISOString()}),
        (${OCC_2A}, ${SEED_ORG_ID}, ${GROUP_ASSERTION}, ${TEST_2A}, ${RUN_2}, ${SEED_PROJECT_ID}, 'main', 'login page renders', 'Expected "Dashboard" but got "Login"', ${daysAgo(5).toISOString()}),
        (${OCC_3A}, ${SEED_ORG_ID}, ${GROUP_ASSERTION}, ${TEST_3A}, ${RUN_3}, ${SEED_PROJECT_ID}, 'feature/login', 'dashboard loads', 'Expected "Dashboard" but got "Login"', ${daysAgo(1).toISOString()}),
        (${OCC_1B}, ${SEED_ORG_ID}, ${GROUP_TIMEOUT}, ${TEST_1B}, ${RUN_1}, ${SEED_PROJECT_ID}, 'main', 'login form submits', 'Timeout 30000ms exceeded', ${daysAgo(2).toISOString()})
      ON CONFLICT DO NOTHING
    `;

    // Daily error stats (for the daily stats query path, range > 7 days)
    await sql`
      INSERT INTO daily_error_stats (organization_id, project_id, error_group_id, date, occurrences, unique_tests, unique_branches)
      VALUES
        (${SEED_ORG_ID}, ${SEED_PROJECT_ID}, ${GROUP_ASSERTION}, ${daysAgo(5).toISOString().slice(0, 10)}, 1, 1, 1),
        (${SEED_ORG_ID}, ${SEED_PROJECT_ID}, ${GROUP_ASSERTION}, ${daysAgo(2).toISOString().slice(0, 10)}, 1, 1, 1),
        (${SEED_ORG_ID}, ${SEED_PROJECT_ID}, ${GROUP_ASSERTION}, ${daysAgo(1).toISOString().slice(0, 10)}, 1, 1, 1),
        (${SEED_ORG_ID}, ${SEED_PROJECT_ID}, ${GROUP_TIMEOUT}, ${daysAgo(2).toISOString().slice(0, 10)}, 1, 1, 1)
      ON CONFLICT DO NOTHING
    `;
  }, 30_000);

  afterAll(async () => {
    await sql`DELETE FROM daily_error_stats WHERE project_id = ${SEED_PROJECT_ID} AND error_group_id IN (${GROUP_ASSERTION}, ${GROUP_TIMEOUT})`;
    await sql`DELETE FROM error_occurrences WHERE error_group_id IN (${GROUP_ASSERTION}, ${GROUP_TIMEOUT})`;
    await sql`DELETE FROM error_groups WHERE id IN (${GROUP_ASSERTION}, ${GROUP_TIMEOUT})`;
    await sql`DELETE FROM runs WHERE id IN (${RUN_1}, ${RUN_2}, ${RUN_3})`;
    await sql.end();
  });

  // ── GET /v1/errors ──────────────────────────────────────────────

  describe('GET /v1/errors (list error groups)', () => {
    it('returns all error groups for the project', async () => {
      const { status, body } = await queryApi.errors.list(jwt, {
        projectId: SEED_PROJECT_ID,
      });

      expect(status).toBe(200);
      const { data: groups } = body as PaginatedGroups;
      expect(groups.length).toBeGreaterThanOrEqual(2);

      const assertion = groups.find((g) => g.id === GROUP_ASSERTION)!;
      expect(assertion).toBeDefined();
      expect(assertion.totalOccurrences).toBe(3);
      expect(assertion.uniqueTestCount).toBe(2);
      expect(assertion.errorCategory).toBe('assertion');
    });

    it('filters by search text', async () => {
      const { status, body } = await queryApi.errors.list(jwt, {
        projectId: SEED_PROJECT_ID,
        search: 'timeout',
      });

      expect(status).toBe(200);
      const { data: groups } = body as PaginatedGroups;
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe(GROUP_TIMEOUT);
    });

    it('filters by category', async () => {
      const { status, body } = await queryApi.errors.list(jwt, {
        projectId: SEED_PROJECT_ID,
        category: 'assertion',
      });

      expect(status).toBe(200);
      const { data: groups } = body as PaginatedGroups;
      expect(groups).toHaveLength(1);
      expect(groups[0].errorCategory).toBe('assertion');
    });

    it('filters by branch (uses occurrences path)', async () => {
      const { status, body } = await queryApi.errors.list(jwt, {
        projectId: SEED_PROJECT_ID,
        branch: 'feature/login',
      });

      expect(status).toBe(200);
      const { data: groups } = body as PaginatedGroups;
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe(GROUP_ASSERTION);
      expect(groups[0].totalOccurrences).toBe(1);
    });

    it('paginates results', async () => {
      const { status, body } = await queryApi.errors.list(jwt, {
        projectId: SEED_PROJECT_ID,
        page: 1,
        pageSize: 1,
      });

      expect(status).toBe(200);
      const { data, meta } = body as PaginatedGroups;
      expect(data).toHaveLength(1);
      expect(meta.total).toBeGreaterThanOrEqual(2);
    });

    it('sorts by specified column', async () => {
      const { status, body } = await queryApi.errors.list(jwt, {
        projectId: SEED_PROJECT_ID,
        sortBy: 'totalOccurrences',
        sortOrder: 'asc',
      });

      expect(status).toBe(200);
      const { data: groups } = body as PaginatedGroups;
      expect(groups.length).toBeGreaterThanOrEqual(2);
      expect(groups[0].totalOccurrences).toBeLessThanOrEqual(groups[1].totalOccurrences);
    });

    it('uses daily stats path for long ranges without double-counting', async () => {
      // 30-day range > ERRORS_SHORT_RANGE_DAYS (7), so uses daily stats path
      const now = Date.now();
      const dateFrom = now - 30 * 86_400_000;
      const { status, body } = await queryApi.errors.list(jwt, {
        projectId: SEED_PROJECT_ID,
        dateFrom,
        dateTo: now,
      });

      expect(status).toBe(200);
      const { data: groups } = body as PaginatedGroups;
      const assertion = groups.find((g) => g.id === GROUP_ASSERTION);
      // 3 occurrences total — daily stats + today supplement should not double-count
      expect(assertion?.totalOccurrences).toBe(3);
    });
  });

  // ── GET /v1/errors/timeline ─────────────────────────────────────

  describe('GET /v1/errors/timeline', () => {
    it('returns timeline series and otherSeries', async () => {
      const { status, body } = await queryApi.errors.timeline(jwt, {
        projectId: SEED_PROJECT_ID,
        topN: 1,
      });

      expect(status).toBe(200);
      const timeline = body as TimelineRow;
      expect(timeline.series).toHaveLength(1);
      expect(timeline.series[0].errorGroupId).toBe(GROUP_ASSERTION);
      expect(timeline.series[0].dataPoints.length).toBeGreaterThan(0);
      expect(timeline.otherSeries.length).toBeGreaterThan(0);
    });

    it('filters timeline by category', async () => {
      const { status, body } = await queryApi.errors.timeline(jwt, {
        projectId: SEED_PROJECT_ID,
        category: 'timeout',
        topN: 5,
      });

      expect(status).toBe(200);
      const timeline = body as TimelineRow;
      expect(timeline.series).toHaveLength(1);
      expect(timeline.series[0].errorGroupId).toBe(GROUP_TIMEOUT);
    });

    it('filters timeline by search text', async () => {
      const { status, body } = await queryApi.errors.timeline(jwt, {
        projectId: SEED_PROJECT_ID,
        search: 'navigation',
        topN: 5,
      });

      expect(status).toBe(200);
      const timeline = body as TimelineRow;
      // Only the timeout group title contains "navigation"
      expect(timeline.series).toHaveLength(1);
      expect(timeline.series[0].errorGroupId).toBe(GROUP_TIMEOUT);
    });

    it('uses occurrences path when branch is specified', async () => {
      const { status, body } = await queryApi.errors.timeline(jwt, {
        projectId: SEED_PROJECT_ID,
        branch: 'main',
        topN: 5,
      });

      expect(status).toBe(200);
      const timeline = body as TimelineRow;
      expect(timeline.series.length).toBeGreaterThan(0);
    });
  });

  // ── GET /v1/errors/:errorGroupId ────────────────────────────────

  describe('GET /v1/errors/:errorGroupId (detail)', () => {
    it('returns full error group detail', async () => {
      const { status, body } = await queryApi.errors.detail(jwt, GROUP_ASSERTION);

      expect(status).toBe(200);
      const detail = body as Record<string, unknown>;
      expect(detail.id).toBe(GROUP_ASSERTION);
      expect(detail.fingerprint).toBe('fp-assertion-login');
      expect(detail.affectedTests).toBeDefined();
      expect(detail.affectedBranches).toBeDefined();
      expect(detail.recentExecutions).toBeDefined();
      expect((detail.affectedTests as unknown[]).length).toBeGreaterThan(0);
      expect((detail.affectedBranches as unknown[]).length).toBeGreaterThan(0);
      expect((detail.recentExecutions as unknown[]).length).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent error group', async () => {
      const fakeId = '01970000-0000-7000-8000-ffffffffffff';
      const { status } = await queryApi.errors.detail(jwt, fakeId);

      expect(status).toBe(404);
    });
  });

  // ── GET /v1/runs/:runId/errors/summary ─────────────────────────

  describe('GET /v1/runs/:runId/errors/summary', () => {
    it('returns top errors and counts for a run', async () => {
      const { status, body } = await queryApi.errors.runSummary(jwt, RUN_1);

      expect(status).toBe(200);
      const summary = body as {
        runId: string;
        totalErrorGroups: number;
        totalFailedTests: number;
        topErrors: Array<{ errorGroupId: string; title: string; occurrences: number }>;
      };
      expect(summary.runId).toBe(RUN_1);
      expect(summary.totalErrorGroups).toBe(2);
      expect(summary.totalFailedTests).toBe(2);
      expect(summary.topErrors.length).toBeGreaterThan(0);
      expect(summary.topErrors[0].occurrences).toBeGreaterThanOrEqual(1);
    });

    it('returns zero counts for a run with no errors', async () => {
      // RUN_2 has only assertion errors — run with 1 occurrence
      // Use a non-existent but valid UUID to test empty case
      const fakeRunId = '01970000-0000-7000-8000-eeeeeeeeeeee';
      const { status, body } = await queryApi.errors.runSummary(jwt, fakeRunId);

      expect(status).toBe(200);
      const summary = body as { totalErrorGroups: number; totalFailedTests: number };
      expect(summary.totalErrorGroups).toBe(0);
      expect(summary.totalFailedTests).toBe(0);
    });
  });
});
