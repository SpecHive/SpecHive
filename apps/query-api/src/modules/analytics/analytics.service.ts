import { Inject, Injectable } from '@nestjs/common';
import type {
  DurationTrendPoint,
  OrganizationAnalyticsSummary,
  OrganizationFlakyTestSummary,
  PassRateTrendPoint,
  ProjectComparisonItem,
} from '@spechive/api-types';
import {
  durationTrendPointSchema,
  organizationAnalyticsSummarySchema,
  organizationFlakyTestSummarySchema,
  passRateTrendPointSchema,
  projectComparisonItemSchema,
} from '@spechive/api-types';
import type { Database } from '@spechive/database';
import { dailyFlakyTestStats, dailyRunStats, projects, setTenantContext } from '@spechive/database';
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
    const lookbackDays = clampedDays - 1;
    const projectFilter = this.buildProjectFilter(dailyRunStats.projectId, projectIds);

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
          COALESCE(SUM(${dailyRunStats.retriedTests}), 0)::int AS "retriedTests",
          COUNT(DISTINCT ${dailyRunStats.projectId})::int AS "projectCount"
        FROM ${dailyRunStats}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${lookbackDays}::int)
          ${projectFilter}
      `);

      return organizationAnalyticsSummarySchema.parse(result[0]);
    });
  }

  async getOrganizationPassRateTrend(
    organizationId: OrganizationId,
    days = 30,
    projectIds?: ProjectId[],
  ): Promise<PassRateTrendPoint[]> {
    const clampedDays = clampDays(days);
    const lookbackDays = clampedDays - 1;
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
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${lookbackDays}::int)
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
    const lookbackDays = clampedDays - 1;
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
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${lookbackDays}::int)
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
    const lookbackDays = clampedDays - 1;
    const clampedLimit = Math.min(Math.max(limit, 1), ANALYTICS_MAX_FLAKY_LIMIT);
    const projectFilter = this.buildProjectFilter(dailyFlakyTestStats.projectId, projectIds);

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
          END AS "avgRetries",
          ${projects.id} AS "projectId",
          ${projects.name} AS "projectName"
        FROM ${dailyFlakyTestStats}
        JOIN ${projects} ON ${projects.id} = ${dailyFlakyTestStats.projectId}
        WHERE ${dailyFlakyTestStats.organizationId} = ${organizationId}
          AND ${dailyFlakyTestStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${lookbackDays}::int)
          ${projectFilter}
        GROUP BY ${dailyFlakyTestStats.testName}, ${projects.id}, ${projects.name}
        HAVING SUM(${dailyFlakyTestStats.flakyCount}) > 0
        ORDER BY (SUM(${dailyFlakyTestStats.flakyCount})::float / NULLIF(SUM(${dailyFlakyTestStats.totalCount}), 0)) DESC NULLS LAST
        LIMIT ${clampedLimit}
      `);

      return organizationFlakyTestSummarySchema.array().parse(result);
    });
  }

  async getProjectComparison(
    organizationId: OrganizationId,
    days = 30,
    projectIds?: ProjectId[],
  ): Promise<ProjectComparisonItem[]> {
    const clampedDays = clampDays(days);
    const lookbackDays = clampedDays - 1;
    const projectFilter = this.buildProjectFilter(dailyRunStats.projectId, projectIds);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          ${dailyRunStats.projectId} AS "projectId",
          ${projects.name} AS "projectName",
          SUM(${dailyRunStats.totalRuns})::int AS "totalRuns",
          SUM(${dailyRunStats.totalTests})::int AS "totalTests",
          SUM(${dailyRunStats.passedTests})::int AS "passedTests",
          SUM(${dailyRunStats.failedTests})::int AS "failedTests",
          SUM(${dailyRunStats.flakyTests})::int AS "flakyTests",
          CASE
            WHEN SUM(${dailyRunStats.totalTests}) > 0
            THEN ROUND((SUM(${dailyRunStats.passedTests})::numeric / SUM(${dailyRunStats.totalTests})::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate",
          CASE
            WHEN SUM(${dailyRunStats.totalRuns}) > 0
            THEN (SUM(${dailyRunStats.sumDurationMs})::float / SUM(${dailyRunStats.totalRuns})::float)
            ELSE 0
          END AS "avgDurationMs"
        FROM ${dailyRunStats}
        JOIN ${projects} ON ${projects.id} = ${dailyRunStats.projectId}
        WHERE ${dailyRunStats.organizationId} = ${organizationId}
          AND ${dailyRunStats.day} >= ((NOW() AT TIME ZONE 'UTC')::date - ${lookbackDays}::int)
          ${projectFilter}
        GROUP BY ${dailyRunStats.projectId}, ${projects.name}
        HAVING SUM(${dailyRunStats.totalRuns}) > 0
        ORDER BY SUM(${dailyRunStats.totalRuns}) DESC
      `);

      return projectComparisonItemSchema.array().parse(result);
    });
  }
}
