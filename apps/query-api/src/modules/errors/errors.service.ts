import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ErrorGroupDetail,
  ErrorGroupSummary,
  ErrorTimelineResponse,
  RunErrorsSummary,
} from '@spechive/api-types';
import {
  errorGroupDetailSchema,
  errorTimelineResponseSchema,
  runErrorsSummarySchema,
} from '@spechive/api-types';
import type { Database } from '@spechive/database';
import {
  dailyErrorStats,
  errorGroups,
  errorOccurrences,
  setTenantContext,
} from '@spechive/database';
import { DATABASE_CONNECTION, escapeLikePattern } from '@spechive/nestjs-common';
import type { ErrorGroupId, OrganizationId, RunId } from '@spechive/shared-types';
import { sql } from 'drizzle-orm';

import { buildPaginatedResponse, getOffset } from '../../common/pagination';

import {
  ERRORS_MAX_DAYS,
  ERRORS_SHORT_RANGE_DAYS,
  ERRORS_TOP_N_MAX,
  ERRORS_TOP_N_MIN,
} from './errors.constants';

interface ListErrorGroupsParams {
  projectId: string;
  dateFrom?: Date;
  dateTo?: Date;
  branch?: string;
  search?: string;
  category?: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

interface ErrorTimelineParams {
  projectId: string;
  dateFrom?: Date;
  dateTo?: Date;
  branch?: string;
  search?: string;
  category?: string;
  metric: 'occurrences' | 'uniqueTests' | 'uniqueBranches';
  topN: number;
}

function clampTopN(n: number): number {
  return Math.min(Math.max(n, ERRORS_TOP_N_MIN), ERRORS_TOP_N_MAX);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

@Injectable()
export class ErrorsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  // ── List Error Groups ─────────────────────────────────────────

  async listErrorGroups(organizationId: OrganizationId, params: ListErrorGroupsParams) {
    const now = new Date();
    const dateTo = params.dateTo ?? now;
    const maxRange = ERRORS_MAX_DAYS * 86_400_000;
    const dateFrom =
      params.dateFrom != null
        ? new Date(Math.max(params.dateFrom.getTime(), dateTo.getTime() - maxRange))
        : new Date(now.getTime() - 30 * 86_400_000);
    const rangeDays = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / 86_400_000);
    const useOccurrences = !!params.branch || rangeDays <= ERRORS_SHORT_RANGE_DAYS;

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);
      const offset = getOffset(params.page, params.pageSize);

      const searchFilter = params.search
        ? sql`(eg.title ILIKE ${`%${escapeLikePattern(params.search)}%`} OR eg.normalized_message ILIKE ${`%${escapeLikePattern(params.search)}%`})`
        : sql``;

      const categoryFilter = params.category
        ? sql`AND eg.error_category = ${params.category}`
        : sql``;

      const orderByClause = this.buildOrderByClause(params.sortBy, params.sortOrder);

      if (useOccurrences) {
        return this.listFromOccurrences(
          tx,
          organizationId,
          params,
          dateFrom,
          dateTo,
          offset,
          searchFilter,
          categoryFilter,
          orderByClause,
        );
      }

      const includesToday = isSameDay(dateTo, now);
      return this.listFromDailyStats(
        tx,
        organizationId,
        params,
        dateFrom,
        dateTo,
        offset,
        searchFilter,
        categoryFilter,
        orderByClause,
        includesToday,
      );
    });
  }

  private async listFromOccurrences(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    _organizationId: OrganizationId,
    params: ListErrorGroupsParams,
    dateFrom: Date,
    dateTo: Date,
    offset: number,
    searchFilter: ReturnType<typeof sql>,
    categoryFilter: ReturnType<typeof sql>,
    orderByClause: ReturnType<typeof sql>,
  ) {
    const branchFilter = params.branch ? sql`AND eo.branch = ${params.branch}` : sql``;

    const dataQuery = sql`
      SELECT
        eg.id,
        eg.project_id AS "projectId",
        eg.title,
        eg.normalized_message AS "normalizedMessage",
        eg.error_name AS "errorName",
        eg.error_category AS "errorCategory",
        COUNT(eo.id)::int AS "totalOccurrences",
        COUNT(DISTINCT eo.test_id)::int AS "uniqueTestCount",
        COUNT(DISTINCT eo.branch)::int AS "uniqueBranchCount",
        MIN(eo.occurred_at)::text AS "firstSeenAt",
        MAX(eo.occurred_at)::text AS "lastSeenAt"
      FROM ${errorOccurrences} eo
      JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
      WHERE eg.project_id = ${params.projectId}
        AND eo.occurred_at >= ${dateFrom.toISOString()}
        AND eo.occurred_at < ${new Date(dateTo.getTime() + 86_400_000).toISOString()}
        ${branchFilter}
        ${params.search ? sql`AND ${searchFilter}` : sql``}
        ${categoryFilter}
      GROUP BY eg.id
      ${orderByClause}
      LIMIT ${params.pageSize} OFFSET ${offset}
    `;

    const countQuery = sql`
      SELECT COUNT(*)::int AS total
      FROM (
        SELECT eg.id
        FROM ${errorOccurrences} eo
        JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
        WHERE eg.project_id = ${params.projectId}
          AND eo.occurred_at >= ${dateFrom.toISOString()}
          AND eo.occurred_at < ${new Date(dateTo.getTime() + 86_400_000).toISOString()}
          ${branchFilter}
          ${params.search ? sql`AND ${searchFilter}` : sql``}
          ${categoryFilter}
        GROUP BY eg.id
      ) sub
    `;

    const [rows, countResult] = await Promise.all([tx.execute(dataQuery), tx.execute(countQuery)]);

    const total = (countResult[0] as { total: number })?.total ?? 0;
    return buildPaginatedResponse(
      rows as unknown as ErrorGroupSummary[],
      total,
      params.page,
      params.pageSize,
    );
  }

  private async listFromDailyStats(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    _organizationId: OrganizationId,
    params: ListErrorGroupsParams,
    dateFrom: Date,
    dateTo: Date,
    offset: number,
    searchFilter: ReturnType<typeof sql>,
    categoryFilter: ReturnType<typeof sql>,
    orderByClause: ReturnType<typeof sql>,
    includesToday: boolean,
  ) {
    const dateFromStr = dateFrom.toISOString().slice(0, 10);
    const dateToStr = dateTo.toISOString().slice(0, 10);

    const todayCte = includesToday
      ? sql`, today_supplement AS (
          SELECT
            eo.error_group_id,
            COUNT(eo.id)::int AS "totalOccurrences",
            COUNT(DISTINCT eo.test_id)::int AS "uniqueTestCount",
            COUNT(DISTINCT eo.branch)::int AS "uniqueBranchCount"
          FROM ${errorOccurrences} eo
          JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
          WHERE eg.project_id = ${params.projectId}
            AND eo.occurred_at >= CURRENT_DATE
          GROUP BY eo.error_group_id
        )`
      : sql``;

    const todayJoin = includesToday
      ? sql`LEFT JOIN today_supplement ts ON ts.error_group_id = d.id`
      : sql``;

    const todaySelects = includesToday
      ? sql`, (d."totalOccurrences" + COALESCE(ts."totalOccurrences", 0))::int AS "totalOccurrences",
           (d."uniqueTestCount" + COALESCE(ts."uniqueTestCount", 0))::int AS "uniqueTestCount",
           (d."uniqueBranchCount" + COALESCE(ts."uniqueBranchCount", 0))::int AS "uniqueBranchCount"`
      : sql`, d."totalOccurrences", d."uniqueTestCount", d."uniqueBranchCount"`;

    const dataQuery = sql`
      WITH daily AS (
        SELECT
          eg.id,
          eg.project_id AS "projectId",
          eg.title,
          eg.normalized_message AS "normalizedMessage",
          eg.error_name AS "errorName",
          eg.error_category AS "errorCategory",
          COALESCE(SUM(des.occurrences), 0)::int AS "totalOccurrences",
          COALESCE(SUM(des.unique_tests), 0)::int AS "uniqueTestCount",
          COALESCE(SUM(des.unique_branches), 0)::int AS "uniqueBranchCount",
          MIN(des.date)::text AS "firstSeenAt",
          MAX(des.date)::text AS "lastSeenAt"
        FROM ${dailyErrorStats} des
        JOIN ${errorGroups} eg ON eg.id = des.error_group_id
        WHERE eg.project_id = ${params.projectId}
          AND des.date >= ${dateFromStr}::date
          AND des.date <= ${dateToStr}::date
          ${params.search ? sql`AND ${searchFilter}` : sql``}
          ${categoryFilter}
        GROUP BY eg.id
      )
      ${todayCte}
      SELECT
        d.id,
        d."projectId",
        d.title,
        d."normalizedMessage",
        d."errorName",
        d."errorCategory"
        ${todaySelects}
        ,
        d."firstSeenAt",
        CASE WHEN ${includesToday ? sql`CURRENT_DATE::text > d."lastSeenAt"` : sql`false`} THEN CURRENT_DATE::text ELSE d."lastSeenAt" END AS "lastSeenAt"
      FROM daily d
      ${todayJoin}
      ${orderByClause}
      LIMIT ${params.pageSize} OFFSET ${offset}
    `;

    const countQuery = sql`
      SELECT COUNT(*)::int AS total FROM (
        SELECT eg.id
        FROM ${dailyErrorStats} des
        JOIN ${errorGroups} eg ON eg.id = des.error_group_id
        WHERE eg.project_id = ${params.projectId}
          AND des.date >= ${dateFromStr}::date
          AND des.date <= ${dateToStr}::date
          ${params.search ? sql`AND ${searchFilter}` : sql``}
          ${categoryFilter}
        GROUP BY eg.id
      ) sub
    `;

    const [rows, countResult] = await Promise.all([tx.execute(dataQuery), tx.execute(countQuery)]);

    const total = (countResult[0] as { total: number })?.total ?? 0;
    const groups = rows as unknown as ErrorGroupSummary[];

    // Daily stats sums overcount unique_tests/unique_branches across days.
    // Compute exact values from error_occurrences for the displayed page.
    if (groups.length > 0) {
      const groupIds = groups.map((g) => g.id);
      const exactCounts = await tx.execute(sql`
        SELECT
          eo.error_group_id AS id,
          COUNT(DISTINCT eo.test_name)::int AS "uniqueTestCount",
          COUNT(DISTINCT eo.branch) FILTER (WHERE eo.branch IS NOT NULL)::int AS "uniqueBranchCount"
        FROM ${errorOccurrences} eo
        WHERE eo.error_group_id = ANY(ARRAY[${sql.join(
          groupIds.map((id) => sql`${id}`),
          sql`, `,
        )}]::uuid[])
          AND eo.occurred_at >= ${dateFrom.toISOString()}
          AND eo.occurred_at < ${new Date(dateTo.getTime() + 86_400_000).toISOString()}
        GROUP BY eo.error_group_id
      `);

      const countMap = new Map(
        (
          exactCounts as unknown as {
            id: string;
            uniqueTestCount: number;
            uniqueBranchCount: number;
          }[]
        ).map((r) => [r.id, r]),
      );
      for (const group of groups) {
        const counts = countMap.get(group.id);
        if (counts) {
          group.uniqueTestCount = counts.uniqueTestCount;
          group.uniqueBranchCount = counts.uniqueBranchCount;
        }
      }
    }

    return buildPaginatedResponse(groups, total, params.page, params.pageSize);
  }

  // ── Error Timeline ────────────────────────────────────────────

  async getErrorTimeline(
    organizationId: OrganizationId,
    params: ErrorTimelineParams,
  ): Promise<ErrorTimelineResponse> {
    const now = new Date();
    const dateTo = params.dateTo ?? now;
    const maxRange = ERRORS_MAX_DAYS * 86_400_000;
    const dateFrom =
      params.dateFrom != null
        ? new Date(Math.max(params.dateFrom.getTime(), dateTo.getTime() - maxRange))
        : new Date(now.getTime() - 30 * 86_400_000);
    const clampedTopN = clampTopN(params.topN);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      if (params.branch) {
        return this.getTimelineFromOccurrences(tx, params, dateFrom, dateTo, clampedTopN);
      }

      return this.getTimelineFromDailyStats(tx, params, dateFrom, dateTo, clampedTopN);
    });
  }

  private async getTimelineFromDailyStats(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    params: ErrorTimelineParams,
    dateFrom: Date,
    dateTo: Date,
    topN: number,
  ): Promise<ErrorTimelineResponse> {
    const dateFromStr = dateFrom.toISOString().slice(0, 10);
    const dateToStr = dateTo.toISOString().slice(0, 10);

    const metricColumn = this.getMetricColumn(params.metric);

    const timelineCategoryFilter = params.category
      ? sql`AND eg.error_category = ${params.category}`
      : sql``;

    const topGroupsQuery = sql`
      SELECT des.error_group_id AS "errorGroupId"
      FROM ${dailyErrorStats} des
      JOIN ${errorGroups} eg ON eg.id = des.error_group_id
      WHERE des.project_id = ${params.projectId}
        AND des.date >= ${dateFromStr}::date
        AND des.date <= ${dateToStr}::date
        ${timelineCategoryFilter}
      GROUP BY des.error_group_id
      ORDER BY SUM(${metricColumn}) DESC
      LIMIT ${topN}
    `;

    const topGroupsResult = await tx.execute(topGroupsQuery);
    const topGroupIds = topGroupsResult.map((r) => (r as { errorGroupId: string }).errorGroupId);

    if (topGroupIds.length === 0) {
      return errorTimelineResponseSchema.parse({ series: [], otherSeries: [] });
    }

    const [seriesResult, otherResult] = await Promise.all([
      tx.execute(sql`
        SELECT
          des.error_group_id AS "errorGroupId",
          eg.title,
          eg.error_name AS "errorName",
          des.date::text AS "date",
          des.occurrences::int,
          des.unique_tests::int AS "uniqueTests",
          des.unique_branches::int AS "uniqueBranches"
        FROM ${dailyErrorStats} des
        JOIN ${errorGroups} eg ON eg.id = des.error_group_id
        WHERE des.project_id = ${params.projectId}
          AND des.date >= ${dateFromStr}::date
          AND des.date <= ${dateToStr}::date
          AND des.error_group_id = ANY(ARRAY[${sql.join(
            topGroupIds.map((id) => sql`${id}`),
            sql`, `,
          )}]::uuid[])
        ORDER BY des.date ASC, des.error_group_id ASC
      `),
      tx.execute(sql`
        SELECT
          des.date::text AS "date",
          COALESCE(SUM(des.occurrences), 0)::int AS occurrences,
          COALESCE(SUM(des.unique_tests), 0)::int AS "uniqueTests",
          COALESCE(SUM(des.unique_branches), 0)::int AS "uniqueBranches"
        FROM ${dailyErrorStats} des
        WHERE des.project_id = ${params.projectId}
          AND des.date >= ${dateFromStr}::date
          AND des.date <= ${dateToStr}::date
          AND des.error_group_id != ALL(ARRAY[${sql.join(
            topGroupIds.map((id) => sql`${id}`),
            sql`, `,
          )}]::uuid[])
        GROUP BY des.date
        ORDER BY des.date ASC
      `),
    ]);

    const seriesMap = new Map<
      string,
      {
        errorGroupId: string;
        title: string;
        errorName: string | null;
        dataPoints: {
          date: string;
          occurrences: number;
          uniqueTests: number;
          uniqueBranches: number;
        }[];
      }
    >();
    for (const row of seriesResult) {
      const typed = row as unknown as {
        errorGroupId: string;
        title: string;
        errorName: string | null;
        date: string;
        occurrences: number;
        uniqueTests: number;
        uniqueBranches: number;
      };
      let series = seriesMap.get(typed.errorGroupId);
      if (!series) {
        series = {
          errorGroupId: typed.errorGroupId,
          title: typed.title,
          errorName: typed.errorName,
          dataPoints: [],
        };
        seriesMap.set(typed.errorGroupId, series);
      }
      series.dataPoints.push({
        date: typed.date,
        occurrences: typed.occurrences,
        uniqueTests: typed.uniqueTests,
        uniqueBranches: typed.uniqueBranches,
      });
    }

    return errorTimelineResponseSchema.parse({
      series: Array.from(seriesMap.values()),
      otherSeries: otherResult,
    });
  }

  private async getTimelineFromOccurrences(
    tx: Parameters<Parameters<typeof this.db.transaction>[0]>[0],
    params: ErrorTimelineParams,
    dateFrom: Date,
    dateTo: Date,
    topN: number,
  ): Promise<ErrorTimelineResponse> {
    const dateToExclusive = new Date(dateTo.getTime() + 86_400_000);
    const metricExpr = this.getOccurrenceMetricExpression(params.metric);
    const occCategoryFilter = params.category
      ? sql`AND eg.error_category = ${params.category}`
      : sql``;

    // Step 1: Identify top N groups by selected metric (SQL-level)
    const topGroupsResult = await tx.execute(sql`
      SELECT eo.error_group_id AS "errorGroupId"
      FROM ${errorOccurrences} eo
      JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
      WHERE eg.project_id = ${params.projectId}
        AND eo.occurred_at >= ${dateFrom.toISOString()}
        AND eo.occurred_at < ${dateToExclusive.toISOString()}
        ${occCategoryFilter}
        AND eo.branch = ${params.branch}
      GROUP BY eo.error_group_id
      ORDER BY ${metricExpr} DESC
      LIMIT ${topN}
    `);

    const topGroupIds = topGroupsResult.map((r) => (r as { errorGroupId: string }).errorGroupId);

    if (topGroupIds.length === 0) {
      return errorTimelineResponseSchema.parse({ series: [], otherSeries: [] });
    }

    // Step 2: Fetch daily breakdown for top groups + "other" aggregate in parallel
    const groupIdArray = sql`ARRAY[${sql.join(
      topGroupIds.map((id) => sql`${id}`),
      sql`, `,
    )}]::uuid[]`;

    const [seriesResult, otherResult] = await Promise.all([
      tx.execute(sql`
        SELECT
          eo.error_group_id AS "errorGroupId",
          eg.title,
          eg.error_name AS "errorName",
          DATE(eo.occurred_at)::text AS "date",
          COUNT(eo.id)::int AS occurrences,
          COUNT(DISTINCT eo.test_id)::int AS "uniqueTests",
          COUNT(DISTINCT eo.branch)::int AS "uniqueBranches"
        FROM ${errorOccurrences} eo
        JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
        WHERE eg.project_id = ${params.projectId}
          AND eo.occurred_at >= ${dateFrom.toISOString()}
          AND eo.occurred_at < ${dateToExclusive.toISOString()}
          AND eo.branch = ${params.branch}
          AND eo.error_group_id = ANY(${groupIdArray})
        GROUP BY eo.error_group_id, eg.title, eg.error_name, DATE(eo.occurred_at)
        ORDER BY "date" ASC, eo.error_group_id ASC
      `),
      tx.execute(sql`
        SELECT
          DATE(eo.occurred_at)::text AS "date",
          COALESCE(COUNT(eo.id), 0)::int AS occurrences,
          COALESCE(COUNT(DISTINCT eo.test_id), 0)::int AS "uniqueTests",
          COALESCE(COUNT(DISTINCT eo.branch), 0)::int AS "uniqueBranches"
        FROM ${errorOccurrences} eo
        JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
        WHERE eg.project_id = ${params.projectId}
          AND eo.occurred_at >= ${dateFrom.toISOString()}
          AND eo.occurred_at < ${dateToExclusive.toISOString()}
          AND eo.branch = ${params.branch}
          AND eo.error_group_id != ALL(${groupIdArray})
        GROUP BY DATE(eo.occurred_at)
        ORDER BY "date" ASC
      `),
    ]);

    const seriesMap = new Map<
      string,
      {
        errorGroupId: string;
        title: string;
        errorName: string | null;
        dataPoints: {
          date: string;
          occurrences: number;
          uniqueTests: number;
          uniqueBranches: number;
        }[];
      }
    >();
    for (const row of seriesResult) {
      const typed = row as unknown as {
        errorGroupId: string;
        title: string;
        errorName: string | null;
        date: string;
        occurrences: number;
        uniqueTests: number;
        uniqueBranches: number;
      };
      let series = seriesMap.get(typed.errorGroupId);
      if (!series) {
        series = {
          errorGroupId: typed.errorGroupId,
          title: typed.title,
          errorName: typed.errorName,
          dataPoints: [],
        };
        seriesMap.set(typed.errorGroupId, series);
      }
      series.dataPoints.push({
        date: typed.date,
        occurrences: typed.occurrences,
        uniqueTests: typed.uniqueTests,
        uniqueBranches: typed.uniqueBranches,
      });
    }

    return errorTimelineResponseSchema.parse({
      series: Array.from(seriesMap.values()),
      otherSeries: otherResult,
    });
  }

  // ── Error Group Detail ────────────────────────────────────────

  async getErrorGroupDetail(
    organizationId: OrganizationId,
    errorGroupId: ErrorGroupId,
  ): Promise<ErrorGroupDetail> {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const [groupResult, testsResult, branchesResult, executionsResult] = await Promise.all([
        tx.execute(sql`
          SELECT
            eg.id,
            eg.project_id AS "projectId",
            eg.fingerprint,
            eg.title,
            eg.normalized_message AS "normalizedMessage",
            eg.error_name AS "errorName",
            eg.error_category AS "errorCategory",
            eg.total_occurrences AS "totalOccurrences",
            eg.unique_test_count AS "uniqueTestCount",
            eg.unique_branch_count AS "uniqueBranchCount",
            eg.first_seen_at::text AS "firstSeenAt",
            eg.last_seen_at::text AS "lastSeenAt",
            eg.created_at::text AS "createdAt",
            eg.updated_at::text AS "updatedAt"
          FROM ${errorGroups} eg
          WHERE eg.id = ${errorGroupId}
        `),
        tx.execute(sql`
          SELECT
            eo.test_name AS "testName",
            COUNT(eo.id)::int AS "occurrenceCount",
            MAX(eo.occurred_at)::text AS "lastSeenAt",
            (ARRAY_AGG(eo.run_id ORDER BY eo.occurred_at DESC))[1] AS "lastRunId",
            (ARRAY_AGG(eo.test_id ORDER BY eo.occurred_at DESC))[1] AS "lastTestId"
          FROM ${errorOccurrences} eo
          WHERE eo.error_group_id = ${errorGroupId}
          GROUP BY eo.test_name
          ORDER BY "occurrenceCount" DESC
          LIMIT 20
        `),
        tx.execute(sql`
          SELECT
            eo.branch,
            COUNT(eo.id)::int AS "occurrenceCount",
            MAX(eo.occurred_at)::text AS "lastSeenAt"
          FROM ${errorOccurrences} eo
          WHERE eo.error_group_id = ${errorGroupId}
          GROUP BY eo.branch
          ORDER BY "occurrenceCount" DESC
          LIMIT 10
        `),
        tx.execute(sql`
          SELECT
            eo.id AS "occurrenceId",
            eo.test_id AS "testId",
            eo.test_name AS "testName",
            eo.run_id AS "runId",
            eo.branch,
            eo.commit_sha AS "commitSha",
            eo.error_message AS "errorMessage",
            eo.occurred_at::text AS "occurredAt"
          FROM ${errorOccurrences} eo
          WHERE eo.error_group_id = ${errorGroupId}
          ORDER BY eo.occurred_at DESC
          LIMIT 20
        `),
      ]);

      const group = groupResult[0];
      if (!group) {
        throw new NotFoundException(`Error group ${errorGroupId} not found`);
      }

      return errorGroupDetailSchema.parse({
        ...group,
        affectedTests: testsResult,
        affectedBranches: branchesResult,
        recentExecutions: executionsResult,
      });
    });
  }

  // ── Run Errors Summary ────────────────────────────────────────

  async getRunErrorsSummary(
    organizationId: OrganizationId,
    runId: RunId,
  ): Promise<RunErrorsSummary> {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const [topErrorsResult, countsResult] = await Promise.all([
        tx.execute(sql`
          SELECT
            eg.id AS "errorGroupId",
            eg.title,
            eg.error_name AS "errorName",
            COUNT(eo.id)::int AS "occurrences"
          FROM ${errorOccurrences} eo
          JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
          WHERE eo.run_id = ${runId}
          GROUP BY eg.id, eg.title, eg.error_name
          ORDER BY "occurrences" DESC
          LIMIT 5
        `),
        tx.execute(sql`
          SELECT
            COUNT(DISTINCT eo.error_group_id)::int AS "totalErrorGroups",
            COUNT(DISTINCT eo.test_id)::int AS "totalFailedTests"
          FROM ${errorOccurrences} eo
          WHERE eo.run_id = ${runId}
        `),
      ]);

      const counts = countsResult[0] as { totalErrorGroups: number; totalFailedTests: number };

      return runErrorsSummarySchema.parse({
        runId,
        totalErrorGroups: counts.totalErrorGroups,
        totalFailedTests: counts.totalFailedTests,
        topErrors: topErrorsResult,
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────

  private getMetricColumn(metric: 'occurrences' | 'uniqueTests' | 'uniqueBranches') {
    switch (metric) {
      case 'occurrences':
        return dailyErrorStats.occurrences;
      case 'uniqueTests':
        return dailyErrorStats.uniqueTests;
      case 'uniqueBranches':
        return dailyErrorStats.uniqueBranches;
    }
  }

  private getOccurrenceMetricExpression(metric: 'occurrences' | 'uniqueTests' | 'uniqueBranches') {
    switch (metric) {
      case 'uniqueTests':
        return sql`COUNT(DISTINCT eo.test_id)`;
      case 'uniqueBranches':
        return sql`COUNT(DISTINCT eo.branch)`;
      default:
        return sql`COUNT(eo.id)`;
    }
  }

  private buildOrderByClause(sortBy: string, sortOrder: 'asc' | 'desc') {
    const direction = sortOrder === 'asc' ? sql`ASC` : sql`DESC`;

    switch (sortBy) {
      case 'totalOccurrences':
        return sql`ORDER BY "totalOccurrences" ${direction}`;
      case 'uniqueTestCount':
        return sql`ORDER BY "uniqueTestCount" ${direction}`;
      case 'uniqueBranchCount':
        return sql`ORDER BY "uniqueBranchCount" ${direction}`;
      case 'lastSeenAt':
        return sql`ORDER BY "lastSeenAt" ${direction}`;
      case 'title':
        return sql`ORDER BY title ${direction}`;
      default:
        return sql`ORDER BY "totalOccurrences" ${direction}`;
    }
  }
}
