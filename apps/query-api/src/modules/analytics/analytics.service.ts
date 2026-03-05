import type {
  DurationTrendPoint,
  FlakyTestSummary,
  PassRateTrendPoint,
  ProjectAnalyticsSummary,
} from '@assertly/api-types';
import type { Database } from '@assertly/database';
import { runs, tests, setTenantContext } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId, ProjectId } from '@assertly/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

const MAX_DAYS = 90;
const MAX_FLAKY_LIMIT = 100;

function clampDays(days: number): number {
  return Math.min(Math.max(days, 1), MAX_DAYS);
}

const projectAnalyticsSummarySchema = z.object({
  totalRuns: z.number(),
  totalTests: z.number(),
  passedTests: z.number(),
  failedTests: z.number(),
  skippedTests: z.number(),
  flakyTests: z.number(),
  passRate: z.number(),
  avgDurationMs: z.number(),
});

const passRateTrendPointSchema = z.object({
  date: z.string(),
  passRate: z.number(),
  totalTests: z.number(),
  passedTests: z.number(),
  failedTests: z.number(),
});

const durationTrendPointSchema = z.object({
  date: z.string(),
  avgDurationMs: z.number(),
  minDurationMs: z.number(),
  maxDurationMs: z.number(),
});

const flakyTestSummarySchema = z.object({
  testName: z.string(),
  flakyCount: z.number(),
  totalRuns: z.number(),
});

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

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          COUNT(*)::int AS "totalRuns",
          COALESCE(SUM(${runs.totalTests}), 0)::int AS "totalTests",
          COALESCE(SUM(${runs.passedTests}), 0)::int AS "passedTests",
          COALESCE(SUM(${runs.failedTests}), 0)::int AS "failedTests",
          COALESCE(SUM(${runs.skippedTests}), 0)::int AS "skippedTests",
          COALESCE(SUM(${runs.flakyTests}), 0)::int AS "flakyTests",
          CASE
            WHEN SUM(${runs.totalTests}) > 0
            THEN ROUND((SUM(${runs.passedTests})::numeric / SUM(${runs.totalTests})::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate",
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (${runs.finishedAt} - ${runs.startedAt})) * 1000
          ), 0)::float AS "avgDurationMs"
        FROM ${runs}
        WHERE ${runs.projectId} = ${projectId}
          AND ${runs.finishedAt} IS NOT NULL
          AND ${runs.finishedAt} >= NOW() - INTERVAL '1 day' * ${clampedDays}
      `);

      if (result.length === 0) {
        return {
          totalRuns: 0,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          flakyTests: 0,
          passRate: 0,
          avgDurationMs: 0,
        };
      }

      return projectAnalyticsSummarySchema.parse(result[0]);
    });
  }

  async getPassRateTrend(
    organizationId: OrganizationId,
    projectId: ProjectId,
    days = 30,
  ): Promise<PassRateTrendPoint[]> {
    const clampedDays = clampDays(days);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          date_trunc('day', ${runs.finishedAt})::date::text AS "date",
          COALESCE(SUM(${runs.totalTests}), 0)::int AS "totalTests",
          COALESCE(SUM(${runs.passedTests}), 0)::int AS "passedTests",
          COALESCE(SUM(${runs.failedTests}), 0)::int AS "failedTests",
          CASE
            WHEN SUM(${runs.totalTests}) > 0
            THEN ROUND((SUM(${runs.passedTests})::numeric / SUM(${runs.totalTests})::numeric) * 100, 2)
            ELSE 0
          END::float AS "passRate"
        FROM ${runs}
        WHERE ${runs.projectId} = ${projectId}
          AND ${runs.finishedAt} IS NOT NULL
          AND ${runs.finishedAt} >= NOW() - INTERVAL '1 day' * ${clampedDays}
        GROUP BY date_trunc('day', ${runs.finishedAt})
        ORDER BY date_trunc('day', ${runs.finishedAt}) ASC
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

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          date_trunc('day', ${runs.finishedAt})::date::text AS "date",
          COALESCE(AVG(EXTRACT(EPOCH FROM (${runs.finishedAt} - ${runs.startedAt})) * 1000), 0)::float AS "avgDurationMs",
          COALESCE(MIN(EXTRACT(EPOCH FROM (${runs.finishedAt} - ${runs.startedAt})) * 1000), 0)::float AS "minDurationMs",
          COALESCE(MAX(EXTRACT(EPOCH FROM (${runs.finishedAt} - ${runs.startedAt})) * 1000), 0)::float AS "maxDurationMs"
        FROM ${runs}
        WHERE ${runs.projectId} = ${projectId}
          AND ${runs.finishedAt} IS NOT NULL
          AND ${runs.startedAt} IS NOT NULL
          AND ${runs.finishedAt} >= NOW() - INTERVAL '1 day' * ${clampedDays}
        GROUP BY date_trunc('day', ${runs.finishedAt})
        ORDER BY date_trunc('day', ${runs.finishedAt}) ASC
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
    const clampedLimit = Math.min(Math.max(limit, 1), MAX_FLAKY_LIMIT);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx.execute(sql`
        SELECT
          ${tests.name} AS "testName",
          COUNT(*)::int AS "flakyCount",
          COUNT(DISTINCT ${tests.runId})::int AS "totalRuns"
        FROM ${tests}
          INNER JOIN ${runs} ON ${runs.id} = ${tests.runId}
        WHERE ${runs.projectId} = ${projectId}
          AND ${tests.status} = 'flaky'
          AND ${runs.finishedAt} IS NOT NULL
          AND ${runs.finishedAt} >= NOW() - INTERVAL '1 day' * ${clampedDays}
        GROUP BY ${tests.name}
        ORDER BY COUNT(*) DESC
        LIMIT ${clampedLimit}
      `);

      return flakyTestSummarySchema.array().parse(result);
    });
  }
}
