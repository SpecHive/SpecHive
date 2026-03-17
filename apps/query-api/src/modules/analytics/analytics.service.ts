import { Inject, Injectable } from '@nestjs/common';
import type {
  DurationTrendPoint,
  FlakyTestSummary,
  PassRateTrendPoint,
  ProjectAnalyticsSummary,
} from '@spechive/api-types';
import {
  durationTrendPointSchema,
  flakyTestSummarySchema,
  passRateTrendPointSchema,
  projectAnalyticsSummarySchema,
} from '@spechive/api-types';
import type { Database } from '@spechive/database';
import { dailyFlakyTestStats, dailyRunStats, setTenantContext } from '@spechive/database';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import type { OrganizationId, ProjectId } from '@spechive/shared-types';
import { sql } from 'drizzle-orm';

import { ANALYTICS_MAX_DAYS, ANALYTICS_MAX_FLAKY_LIMIT } from './analytics.constants';

function clampDays(days: number): number {
  return Math.min(Math.max(days, 1), ANALYTICS_MAX_DAYS);
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async getProjectSummary(
    organizationId: OrganizationId,
    projectId: ProjectId,
    days = 30,
  ): Promise<ProjectAnalyticsSummary> {
    const clampedDays = clampDays(days);
    // Inclusive lookback: days=30 → today + 29 previous calendar days = 30 days total
    const lookbackDays = clampedDays - 1;

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
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
          COALESCE(SUM(${dailyRunStats.retriedTests}), 0)::int AS "retriedTests"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.projectId} = ${projectId}
          AND ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${lookbackDays})
      `);

      // Aggregate queries without GROUP BY always return exactly one row (NULLs become 0 via COALESCE)
      return projectAnalyticsSummarySchema.parse(result[0]);
    });
  }

  async getPassRateTrend(
    organizationId: OrganizationId,
    projectId: ProjectId,
    days = 30,
  ): Promise<PassRateTrendPoint[]> {
    const clampedDays = clampDays(days);
    const lookbackDays = clampedDays - 1;

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          ${dailyRunStats.day}::text AS "date",
          ${dailyRunStats.totalTests} AS "totalTests",
          ${dailyRunStats.passedTests} AS "passedTests",
          ${dailyRunStats.failedTests} AS "failedTests",
          CASE
            WHEN ${dailyRunStats.totalTests} > 0
            THEN ROUND((${dailyRunStats.passedTests}::numeric / ${dailyRunStats.totalTests}::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.projectId} = ${projectId}
          AND ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${lookbackDays})
        ORDER BY ${dailyRunStats.day} ASC
      `);

      return passRateTrendPointSchema.array().parse(result);
    });
  }

  async getDurationTrend(
    organizationId: OrganizationId,
    projectId: ProjectId,
    days = 30,
  ): Promise<DurationTrendPoint[]> {
    const clampedDays = clampDays(days);
    const lookbackDays = clampedDays - 1;

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          ${dailyRunStats.day}::text AS "date",
          CASE
            WHEN ${dailyRunStats.totalRuns} > 0
            THEN (${dailyRunStats.sumDurationMs}::float / ${dailyRunStats.totalRuns}::float)
            ELSE 0
          END AS "avgDurationMs",
          ${dailyRunStats.minDurationMs} AS "minDurationMs",
          ${dailyRunStats.maxDurationMs} AS "maxDurationMs"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.projectId} = ${projectId}
          AND ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${lookbackDays})
        ORDER BY ${dailyRunStats.day} ASC
      `);

      return durationTrendPointSchema.array().parse(result);
    });
  }

  async getFlakyTests(
    organizationId: OrganizationId,
    projectId: ProjectId,
    days = 30,
    limit = 10,
  ): Promise<FlakyTestSummary[]> {
    const clampedDays = clampDays(days);
    const lookbackDays = clampedDays - 1;
    const clampedLimit = Math.min(Math.max(limit, 1), ANALYTICS_MAX_FLAKY_LIMIT);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          ${dailyFlakyTestStats.testName} AS "testName",
          SUM(${dailyFlakyTestStats.flakyCount})::int AS "flakyCount",
          SUM(${dailyFlakyTestStats.totalCount})::int AS "totalRuns",
          CASE
            WHEN SUM(${dailyFlakyTestStats.flakyCount}) > 0
            THEN (SUM(${dailyFlakyTestStats.totalRetries})::float / SUM(${dailyFlakyTestStats.flakyCount})::float)
            ELSE 0
          END AS "avgRetries"
        FROM ${dailyFlakyTestStats}
        WHERE ${dailyFlakyTestStats.projectId} = ${projectId}
          AND ${dailyFlakyTestStats.organizationId} = ${organizationId}
          AND ${dailyFlakyTestStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${lookbackDays})
        GROUP BY ${dailyFlakyTestStats.testName}
        HAVING SUM(${dailyFlakyTestStats.flakyCount}) > 0
        ORDER BY (SUM(${dailyFlakyTestStats.flakyCount})::float / NULLIF(SUM(${dailyFlakyTestStats.totalCount}), 0)) DESC NULLS LAST
        LIMIT ${clampedLimit}
      `);

      return flakyTestSummarySchema.array().parse(result);
    });
  }
}
