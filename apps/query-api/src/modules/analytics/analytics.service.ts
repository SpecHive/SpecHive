import { Inject, Injectable } from '@nestjs/common';
import type {
  DurationTrendPoint,
  OrganizationAnalyticsSummary,
  OrganizationFlakyTestSummary,
  PassRateTrendPoint,
  ProjectComparisonResponse,
} from '@spechive/api-types';
import {
  durationTrendPointSchema,
  organizationAnalyticsSummarySchema,
  organizationFlakyTestSummarySchema,
  passRateTrendPointSchema,
  projectComparisonResponseSchema,
} from '@spechive/api-types';
import type { Database } from '@spechive/database';
import { dailyFlakyTestStats, dailyRunStats, projects, setTenantContext } from '@spechive/database';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import type { OrganizationId, ProjectId } from '@spechive/shared-types';
import { sql } from 'drizzle-orm';

import { ANALYTICS_MAX_DAYS, ANALYTICS_MAX_FLAKY_LIMIT } from './analytics.constants';
import { computeHealthScore, computeOrgMedianDuration, safeRate } from './health-score';

function clampDays(days: number): number {
  return Math.min(Math.max(days, 1), ANALYTICS_MAX_DAYS);
}

// ── Query-result row shapes ──────────────────────────────────────────

interface SummaryRow {
  totalRuns: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  flakyTests: number;
  passRate: number;
  avgDurationMs: number;
  retriedTests: number;
  projectCount: number;
}

interface PrevPeriodRow {
  totalTests: number;
  passedTests: number;
  flakyTests: number;
}

interface CurrentProjectRow {
  projectId: string;
  projectName: string;
  totalRuns: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  flakyTests: number;
  retriedTests: number;
  passRate: number;
  avgDurationMs: number;
  minDurationMs: number | null;
  maxDurationMs: number | null;
}

interface PrevProjectRow {
  projectId: string;
  totalTests: number;
  passedTests: number;
  flakyTests: number;
  passRate: number;
  flakyRate: number;
  avgDurationMs: number;
}

interface SparklineRow {
  projectId: string;
  date: string;
  passRate: number;
}

interface OrgSparklineRow {
  date: string;
  passRate: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  private buildProjectFilter(
    column: typeof dailyRunStats.projectId | typeof dailyFlakyTestStats.projectId,
    projectIds?: ProjectId[],
  ) {
    return projectIds?.length
      ? sql`AND ${column} = ANY(ARRAY[${sql.join(
          projectIds.map((id) => sql`${id}`),
          sql`, `,
        )}]::uuid[])`
      : sql``;
  }

  async getOrganizationSummary(
    organizationId: OrganizationId,
    days = 30,
    projectIds?: ProjectId[],
  ): Promise<OrganizationAnalyticsSummary> {
    const clampedDays = clampDays(days);
    const offsetDays = clampedDays - 1;
    const projectFilter = this.buildProjectFilter(dailyRunStats.projectId, projectIds);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const summaryQuery = sql`
        SELECT
          COALESCE(SUM(${dailyRunStats.totalRuns}), 0)::int AS "totalRuns",
          COALESCE(SUM(${dailyRunStats.totalTests}), 0)::int AS "totalTests",
          COALESCE(SUM(${dailyRunStats.passedTests}), 0)::int AS "passedTests",
          COALESCE(SUM(${dailyRunStats.failedTests}), 0)::int AS "failedTests",
          COALESCE(SUM(${dailyRunStats.skippedTests}), 0)::int AS "skippedTests",
          COALESCE(SUM(${dailyRunStats.flakyTests}), 0)::int AS "flakyTests",
          CASE
            WHEN SUM(${dailyRunStats.totalTests}) > 0
            THEN ROUND((SUM(${dailyRunStats.passedTests})::numeric / SUM(${dailyRunStats.totalTests})::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate",
          CASE
            WHEN SUM(${dailyRunStats.totalRuns}) > 0
            THEN (SUM(${dailyRunStats.sumDurationMs})::float / SUM(${dailyRunStats.totalRuns})::float)
            ELSE 0
          END AS "avgDurationMs",
          COALESCE(SUM(${dailyRunStats.retriedTests}), 0)::int AS "retriedTests",
          COUNT(DISTINCT ${dailyRunStats.projectId})::int AS "projectCount"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
          ${projectFilter}
      `;

      // Previous period for deltas
      const prevQuery = sql`
        SELECT
          COALESCE(SUM(${dailyRunStats.totalTests}), 0)::int AS "totalTests",
          COALESCE(SUM(${dailyRunStats.passedTests}), 0)::int AS "passedTests",
          COALESCE(SUM(${dailyRunStats.flakyTests}), 0)::int AS "flakyTests"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays + clampedDays}::int)
          AND ${dailyRunStats.day} < ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
          ${projectFilter}
      `;

      const [result, prevResult] = await Promise.all([
        tx.execute(summaryQuery),
        tx.execute(prevQuery),
      ]);

      const current = result[0] as unknown as SummaryRow;
      const prev = prevResult[0] as unknown as PrevPeriodRow;

      const prevPassRate =
        prev.totalTests > 0 ? Math.round((prev.passedTests / prev.totalTests) * 10000) / 100 : null;
      const passRateDelta =
        prevPassRate !== null ? Math.round((current.passRate - prevPassRate) * 100) / 100 : null;

      const currentFlakyRate = safeRate(current.flakyTests, current.totalTests);
      const prevFlakyRate = prev.totalTests > 0 ? safeRate(prev.flakyTests, prev.totalTests) : null;
      const flakyRateDelta =
        prevFlakyRate !== null ? Math.round((currentFlakyRate - prevFlakyRate) * 100) / 100 : null;

      return organizationAnalyticsSummarySchema.parse({
        ...current,
        passRateDelta,
        flakyRate: currentFlakyRate,
        flakyRateDelta,
      });
    });
  }

  async getOrganizationPassRateTrend(
    organizationId: OrganizationId,
    days = 30,
    projectIds?: ProjectId[],
  ): Promise<PassRateTrendPoint[]> {
    const clampedDays = clampDays(days);
    const offsetDays = clampedDays - 1;
    const projectFilter = this.buildProjectFilter(dailyRunStats.projectId, projectIds);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          ${dailyRunStats.day}::text AS "date",
          SUM(${dailyRunStats.totalTests})::int AS "totalTests",
          SUM(${dailyRunStats.passedTests})::int AS "passedTests",
          SUM(${dailyRunStats.failedTests})::int AS "failedTests",
          CASE
            WHEN SUM(${dailyRunStats.totalTests}) > 0
            THEN ROUND((SUM(${dailyRunStats.passedTests})::numeric / SUM(${dailyRunStats.totalTests})::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
          ${projectFilter}
        GROUP BY ${dailyRunStats.day}
        ORDER BY ${dailyRunStats.day} ASC
      `);

      return passRateTrendPointSchema.array().parse(result);
    });
  }

  async getOrganizationDurationTrend(
    organizationId: OrganizationId,
    days = 30,
    projectIds?: ProjectId[],
  ): Promise<DurationTrendPoint[]> {
    const clampedDays = clampDays(days);
    const offsetDays = clampedDays - 1;
    const projectFilter = this.buildProjectFilter(dailyRunStats.projectId, projectIds);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          ${dailyRunStats.day}::text AS "date",
          CASE
            WHEN SUM(${dailyRunStats.totalRuns}) > 0
            THEN (SUM(${dailyRunStats.sumDurationMs})::float / SUM(${dailyRunStats.totalRuns})::float)
            ELSE 0
          END AS "avgDurationMs",
          MIN(${dailyRunStats.minDurationMs}) AS "minDurationMs",
          MAX(${dailyRunStats.maxDurationMs}) AS "maxDurationMs"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
          ${projectFilter}
        GROUP BY ${dailyRunStats.day}
        ORDER BY ${dailyRunStats.day} ASC
      `);

      return durationTrendPointSchema.array().parse(result);
    });
  }

  async getOrganizationFlakyTests(
    organizationId: OrganizationId,
    days = 30,
    limit = 10,
    projectIds?: ProjectId[],
  ): Promise<OrganizationFlakyTestSummary[]> {
    const clampedDays = clampDays(days);
    const offsetDays = clampedDays - 1;
    const clampedLimit = Math.min(Math.max(limit, 1), ANALYTICS_MAX_FLAKY_LIMIT);
    const projectFilter = this.buildProjectFilter(dailyFlakyTestStats.projectId, projectIds);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      // Current period flaky tests with previous-period delta via LEFT JOIN
      const result = await tx.execute(sql`
        WITH current_period AS (
          SELECT
            ${dailyFlakyTestStats.testName} AS test_name,
            ${dailyFlakyTestStats.projectId} AS project_id,
            SUM(${dailyFlakyTestStats.flakyCount})::int AS flaky_count,
            SUM(${dailyFlakyTestStats.totalCount})::int AS total_runs,
            CASE
              WHEN SUM(${dailyFlakyTestStats.flakyCount}) > 0
              THEN (SUM(${dailyFlakyTestStats.totalRetries})::float / SUM(${dailyFlakyTestStats.flakyCount})::float)
              ELSE 0
            END AS avg_retries
          FROM ${dailyFlakyTestStats}
          WHERE ${dailyFlakyTestStats.organizationId} = ${organizationId}
            AND ${dailyFlakyTestStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
            ${projectFilter}
          GROUP BY ${dailyFlakyTestStats.testName}, ${dailyFlakyTestStats.projectId}
          HAVING SUM(${dailyFlakyTestStats.flakyCount}) > 0
        ),
        prev_period AS (
          SELECT
            ${dailyFlakyTestStats.testName} AS test_name,
            ${dailyFlakyTestStats.projectId} AS project_id,
            SUM(${dailyFlakyTestStats.flakyCount})::int AS flaky_count
          FROM ${dailyFlakyTestStats}
          WHERE ${dailyFlakyTestStats.organizationId} = ${organizationId}
            AND ${dailyFlakyTestStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays + clampedDays}::int)
            AND ${dailyFlakyTestStats.day} < ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
            ${projectFilter}
          GROUP BY ${dailyFlakyTestStats.testName}, ${dailyFlakyTestStats.projectId}
        )
        SELECT
          cp.test_name AS "testName",
          cp.flaky_count AS "flakyCount",
          cp.total_runs AS "totalRuns",
          cp.avg_retries AS "avgRetries",
          cp.project_id AS "projectId",
          ${projects.name} AS "projectName",
          CASE
            WHEN pp.flaky_count IS NOT NULL THEN cp.flaky_count - pp.flaky_count
            ELSE NULL
          END::int AS "flakyCountDelta"
        FROM current_period cp
        JOIN ${projects} ON ${projects.id} = cp.project_id
        LEFT JOIN prev_period pp ON pp.test_name = cp.test_name AND pp.project_id = cp.project_id
        ORDER BY (cp.flaky_count::float / NULLIF(cp.total_runs, 0)) DESC NULLS LAST
        LIMIT ${clampedLimit}
      `);

      return organizationFlakyTestSummarySchema.array().parse(result);
    });
  }

  async getProjectComparison(
    organizationId: OrganizationId,
    days = 30,
    projectIds?: ProjectId[],
  ): Promise<ProjectComparisonResponse> {
    const clampedDays = clampDays(days);
    const offsetDays = clampedDays - 1;
    const projectFilter = this.buildProjectFilter(dailyRunStats.projectId, projectIds);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      // Q1: Current period per-project aggregates
      const currentQuery = sql`
        SELECT
          ${dailyRunStats.projectId} AS "projectId",
          ${projects.name} AS "projectName",
          SUM(${dailyRunStats.totalRuns})::int AS "totalRuns",
          SUM(${dailyRunStats.totalTests})::int AS "totalTests",
          SUM(${dailyRunStats.passedTests})::int AS "passedTests",
          SUM(${dailyRunStats.failedTests})::int AS "failedTests",
          SUM(${dailyRunStats.skippedTests})::int AS "skippedTests",
          SUM(${dailyRunStats.flakyTests})::int AS "flakyTests",
          SUM(${dailyRunStats.retriedTests})::int AS "retriedTests",
          CASE
            WHEN SUM(${dailyRunStats.totalTests}) > 0
            THEN ROUND((SUM(${dailyRunStats.passedTests})::numeric / SUM(${dailyRunStats.totalTests})::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate",
          CASE
            WHEN SUM(${dailyRunStats.totalRuns}) > 0
            THEN (SUM(${dailyRunStats.sumDurationMs})::float / SUM(${dailyRunStats.totalRuns})::float)
            ELSE 0
          END AS "avgDurationMs",
          MIN(${dailyRunStats.minDurationMs}) AS "minDurationMs",
          MAX(${dailyRunStats.maxDurationMs}) AS "maxDurationMs"
        FROM ${dailyRunStats}
        JOIN ${projects} ON ${projects.id} = ${dailyRunStats.projectId}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
          ${projectFilter}
        GROUP BY ${dailyRunStats.projectId}, ${projects.name}
        HAVING SUM(${dailyRunStats.totalRuns}) > 0
        ORDER BY SUM(${dailyRunStats.totalRuns}) DESC
      `;

      // Q2: Previous period per-project aggregates (for deltas)
      const prevQuery = sql`
        SELECT
          ${dailyRunStats.projectId} AS "projectId",
          SUM(${dailyRunStats.totalTests})::int AS "totalTests",
          SUM(${dailyRunStats.passedTests})::int AS "passedTests",
          SUM(${dailyRunStats.flakyTests})::int AS "flakyTests",
          CASE
            WHEN SUM(${dailyRunStats.totalTests}) > 0
            THEN ROUND((SUM(${dailyRunStats.passedTests})::numeric / SUM(${dailyRunStats.totalTests})::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate",
          CASE
            WHEN SUM(${dailyRunStats.totalTests}) > 0
            THEN ROUND((SUM(${dailyRunStats.flakyTests})::numeric / SUM(${dailyRunStats.totalTests})::numeric) * 100, 2)
            ELSE 0
          END::float AS "flakyRate",
          CASE
            WHEN SUM(${dailyRunStats.totalRuns}) > 0
            THEN (SUM(${dailyRunStats.sumDurationMs})::float / SUM(${dailyRunStats.totalRuns})::float)
            ELSE 0
          END AS "avgDurationMs"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays + clampedDays}::int)
          AND ${dailyRunStats.day} < ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
          ${projectFilter}
        GROUP BY ${dailyRunStats.projectId}
        HAVING SUM(${dailyRunStats.totalRuns}) > 0
      `;

      // Q3: Per-project daily pass rates for sparklines.
      // No GROUP BY needed — daily_run_stats has a PRIMARY KEY on (project_id, day),
      // guaranteeing one row per project per day.
      const sparklineQuery = sql`
        SELECT
          ${dailyRunStats.projectId} AS "projectId",
          ${dailyRunStats.day}::text AS "date",
          CASE
            WHEN ${dailyRunStats.totalTests} > 0
            THEN ROUND((${dailyRunStats.passedTests}::numeric / ${dailyRunStats.totalTests}::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
          ${projectFilter}
        ORDER BY ${dailyRunStats.projectId}, ${dailyRunStats.day} ASC
      `;

      // Q4: Org-level daily pass rates for org sparkline
      const orgSparklineQuery = sql`
        SELECT
          ${dailyRunStats.day}::text AS "date",
          CASE
            WHEN SUM(${dailyRunStats.totalTests}) > 0
            THEN ROUND((SUM(${dailyRunStats.passedTests})::numeric / SUM(${dailyRunStats.totalTests})::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${offsetDays}::int)
          ${projectFilter}
        GROUP BY ${dailyRunStats.day}
        ORDER BY ${dailyRunStats.day} ASC
      `;

      const [currentResult, prevResult, sparklineResult, orgSparklineResult] = await Promise.all([
        tx.execute(currentQuery),
        tx.execute(prevQuery),
        tx.execute(sparklineQuery),
        tx.execute(orgSparklineQuery),
      ]);

      // Index previous period by projectId
      const prevByProject = new Map<string, PrevProjectRow>();
      for (const row of prevResult as unknown as PrevProjectRow[]) {
        prevByProject.set(row.projectId, row);
      }

      // Index sparkline data by projectId
      const sparklinesByProject = new Map<string, Array<{ date: string; passRate: number }>>();
      for (const row of sparklineResult as unknown as SparklineRow[]) {
        if (!sparklinesByProject.has(row.projectId)) sparklinesByProject.set(row.projectId, []);
        sparklinesByProject.get(row.projectId)!.push({ date: row.date, passRate: row.passRate });
      }

      const currentRows = currentResult as unknown as CurrentProjectRow[];
      const orgMedianDurationMs = computeOrgMedianDuration(currentRows.map((r) => r.avgDurationMs));

      const enrichedProjects = currentRows.map((row) =>
        this.enrichProjectRow(
          row,
          prevByProject,
          sparklinesByProject,
          orgMedianDurationMs,
          currentRows.length,
        ),
      );

      const orgDailyPassRates = (orgSparklineResult as unknown as OrgSparklineRow[]).map((row) => ({
        date: row.date,
        passRate: row.passRate,
      }));

      return projectComparisonResponseSchema.parse(
        this.computeOrgAverages(enrichedProjects, orgDailyPassRates, orgMedianDurationMs),
      );
    });
  }

  private enrichProjectRow(
    row: CurrentProjectRow,
    prevByProject: Map<string, PrevProjectRow>,
    sparklinesByProject: Map<string, Array<{ date: string; passRate: number }>>,
    orgMedianDurationMs: number,
    projectCount: number,
  ) {
    const {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      flakyTests,
      totalRuns,
      retriedTests,
      avgDurationMs,
      passRate,
    } = row;

    const failRate = safeRate(failedTests, totalTests);
    const flakyRate = safeRate(flakyTests, totalTests);
    const skipRate = safeRate(skippedTests, totalTests);
    const avgTestsPerRun = totalRuns > 0 ? Math.round((totalTests / totalRuns) * 100) / 100 : 0;

    // Period-over-period deltas
    const prev = prevByProject.get(row.projectId);
    const passRateDelta = prev ? Math.round((passRate - prev.passRate) * 100) / 100 : null;
    const flakyRateDelta = prev ? Math.round((flakyRate - prev.flakyRate) * 100) / 100 : null;
    const avgDurationDelta = prev ? Math.round(avgDurationMs - prev.avgDurationMs) : null;

    const healthScore = computeHealthScore({
      passRate,
      flakyRate,
      skipRate,
      avgDurationMs,
      orgMedianDurationMs,
      projectCount,
    });

    return {
      projectId: row.projectId,
      projectName: row.projectName,
      totalRuns,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      flakyTests,
      retriedTests,
      passRate,
      failRate,
      flakyRate,
      skipRate,
      avgTestsPerRun,
      avgDurationMs,
      minDurationMs: row.minDurationMs ?? null,
      maxDurationMs: row.maxDurationMs ?? null,
      passRateDelta,
      flakyRateDelta,
      avgDurationDelta,
      dailyPassRates: sparklinesByProject.get(row.projectId) ?? [],
      healthScore,
    };
  }

  private computeOrgAverages(
    enrichedProjects: ReturnType<AnalyticsService['enrichProjectRow']>[],
    orgDailyPassRates: Array<{ date: string; passRate: number }>,
    orgMedianDurationMs: number,
  ) {
    let orgTotalTests = 0;
    let orgPassedTests = 0;
    let orgFlakyTests = 0;
    let orgSkippedTests = 0;
    let orgTotalDurationWeighted = 0;
    let orgTotalRuns = 0;
    let orgRetriedTests = 0;

    for (const p of enrichedProjects) {
      orgTotalTests += p.totalTests;
      orgPassedTests += p.passedTests;
      orgFlakyTests += p.flakyTests;
      orgSkippedTests += p.skippedTests;
      orgTotalDurationWeighted += p.avgDurationMs * p.totalRuns;
      orgTotalRuns += p.totalRuns;
      orgRetriedTests += p.retriedTests;
    }

    const orgPassRate = safeRate(orgPassedTests, orgTotalTests);
    const orgFlakyRate = safeRate(orgFlakyTests, orgTotalTests);
    const orgSkipRate = safeRate(orgSkippedTests, orgTotalTests);
    const orgAvgDurationMs = orgTotalRuns > 0 ? orgTotalDurationWeighted / orgTotalRuns : 0;
    const orgHealthScore = computeHealthScore({
      passRate: orgPassRate,
      flakyRate: orgFlakyRate,
      skipRate: orgSkipRate,
      avgDurationMs: orgAvgDurationMs,
      orgMedianDurationMs,
      projectCount: enrichedProjects.length,
    });

    return {
      projects: enrichedProjects,
      orgAverage: {
        passRate: orgPassRate,
        flakyRate: orgFlakyRate,
        skipRate: orgSkipRate,
        avgDurationMs: orgAvgDurationMs,
        healthScore: orgHealthScore,
        totalRuns: orgTotalRuns,
        retriedTests: orgRetriedTests,
        dailyPassRates: orgDailyPassRates,
      },
    };
  }
}
