import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ErrorGroupDetail,
  ErrorTimelineResponse,
  ErrorTimelineSeries,
  RunErrorsSummary,
} from '@spechive/api-types';
import {
  errorGroupDetailSchema,
  errorGroupSummarySchema,
  errorTimelineResponseSchema,
  runErrorsSummarySchema,
} from '@spechive/api-types';
import type { Database } from '@spechive/database';
import { errorGroups, errorOccurrences, setTenantContext } from '@spechive/database';
import { DATABASE_CONNECTION, escapeLikePattern } from '@spechive/nestjs-common';
import type { ErrorGroupId, OrganizationId, ProjectId, RunId } from '@spechive/shared-types';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { buildPaginatedResponse, getOffset } from '../../common/pagination';

import {
  DETAIL_AFFECTED_TESTS_LIMIT,
  DETAIL_BRANCHES_LIMIT,
  DETAIL_EXECUTIONS_LIMIT,
  ERRORS_MAX_DAYS,
  ERRORS_TOP_N_MAX,
  ERRORS_TOP_N_MIN,
  MS_PER_DAY,
} from './errors.constants';

type SqlFragment = ReturnType<typeof sql>;
type ErrorMetric = 'occurrences' | 'uniqueTests' | 'uniqueBranches';

interface ListErrorGroupsParams {
  projectId: ProjectId;
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
  projectId: ProjectId;
  dateFrom?: Date;
  dateTo?: Date;
  branch?: string;
  search?: string;
  category?: string;
  metric: ErrorMetric;
  topN: number;
}

interface ErrorGroupDetailParams {
  errorGroupId: ErrorGroupId;
  dateFrom?: Date;
  dateTo?: Date;
}

interface FilterParams {
  search?: string;
  category?: string;
}

function clampTopN(n: number): number {
  return Math.min(Math.max(n, ERRORS_TOP_N_MIN), ERRORS_TOP_N_MAX);
}

/** Resolves dateFrom/dateTo with max range clamping and 30-day default. */
function resolveDateRange(params: { dateFrom?: Date; dateTo?: Date }) {
  const now = new Date();
  const dateTo = params.dateTo ?? now;
  const maxRange = ERRORS_MAX_DAYS * MS_PER_DAY;
  const dateFrom =
    params.dateFrom != null
      ? new Date(Math.max(params.dateFrom.getTime(), dateTo.getTime() - maxRange))
      : new Date(now.getTime() - 30 * MS_PER_DAY);
  return { dateFrom, dateTo };
}

@Injectable()
export class ErrorsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  // ── Shared filter/sort helpers ──────────────────────────────────

  private static readonly sortColumns: Record<string, SqlFragment> = {
    totalOccurrences: sql`"totalOccurrences"`,
    uniqueTestCount: sql`"uniqueTestCount"`,
    uniqueBranchCount: sql`"uniqueBranchCount"`,
    lastSeenAt: sql`"lastSeenAt"`,
    title: sql`title`,
  };

  /** Builds search + category SQL fragments for WHERE clauses. Always safe to include (no-op when empty). */
  private buildFilters(params: FilterParams): {
    searchFilter: SqlFragment;
    categoryFilter: SqlFragment;
  } {
    const searchFilter = params.search
      ? sql`AND (eg.title ILIKE ${`%${escapeLikePattern(params.search)}%`} OR eg.normalized_message ILIKE ${`%${escapeLikePattern(params.search)}%`})`
      : sql``;

    const categoryFilter = params.category
      ? params.category === 'uncategorized'
        ? sql`AND eg.error_category IS NULL`
        : sql`AND eg.error_category = ${params.category}`
      : sql``;

    return { searchFilter, categoryFilter };
  }

  private buildOrderByClause(sortBy: string, sortOrder: 'asc' | 'desc'): SqlFragment {
    const direction = sortOrder === 'asc' ? sql`ASC` : sql`DESC`;
    const column = ErrorsService.sortColumns[sortBy] ?? ErrorsService.sortColumns.totalOccurrences;
    return sql`ORDER BY ${column} ${direction}`;
  }

  private getMetricExpression(metric: ErrorMetric): SqlFragment {
    switch (metric) {
      case 'uniqueTests':
        return sql`COUNT(DISTINCT eo.test_name)`;
      case 'uniqueBranches':
        return sql`COUNT(DISTINCT eo.branch) FILTER (WHERE eo.branch IS NOT NULL)`;
      default:
        return sql`COUNT(eo.id)`;
    }
  }

  /** Assembles timeline series from raw query rows into the grouped format. */
  private assembleTimelineSeries(rows: Record<string, unknown>[]): ErrorTimelineSeries[] {
    const seriesMap = new Map<string, ErrorTimelineSeries>();
    for (const row of rows) {
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
    return Array.from(seriesMap.values());
  }

  private buildOccurrencesWhereClause(
    params: { projectId: ProjectId; branch?: string },
    dateFrom: Date,
    dateTo: Date,
    searchFilter: SqlFragment,
    categoryFilter: SqlFragment,
  ): SqlFragment {
    const branchFilter = params.branch ? sql`AND eo.branch = ${params.branch}` : sql``;
    const dateToExclusive = new Date(dateTo.getTime() + MS_PER_DAY).toISOString();
    return sql`
      WHERE eg.project_id = ${params.projectId}
        AND eo.occurred_at >= ${dateFrom.toISOString()}
        AND eo.occurred_at < ${dateToExclusive}
        ${branchFilter}
        ${searchFilter}
        ${categoryFilter}
    `;
  }

  // ── List Error Groups ─────────────────────────────────────────

  async listErrorGroups(organizationId: OrganizationId, params: ListErrorGroupsParams) {
    const { dateFrom, dateTo } = resolveDateRange(params);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);
      const offset = getOffset(params.page, params.pageSize);
      const { searchFilter, categoryFilter } = this.buildFilters(params);
      const orderByClause = this.buildOrderByClause(params.sortBy, params.sortOrder);

      const whereClause = this.buildOccurrencesWhereClause(
        params,
        dateFrom,
        dateTo,
        searchFilter,
        categoryFilter,
      );

      const [rows, countResult] = await Promise.all([
        tx.execute(sql`
          SELECT
            eg.id,
            eg.project_id AS "projectId",
            eg.title,
            eg.normalized_message AS "normalizedMessage",
            eg.error_name AS "errorName",
            eg.error_category AS "errorCategory",
            COUNT(eo.id)::int AS "totalOccurrences",
            COUNT(DISTINCT eo.test_name)::int AS "uniqueTestCount",
            COUNT(DISTINCT eo.branch) FILTER (WHERE eo.branch IS NOT NULL)::int AS "uniqueBranchCount",
            eg.first_seen_at::text AS "firstSeenAt",
            MAX(eo.occurred_at)::text AS "lastSeenAt"
          FROM ${errorOccurrences} eo
          JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
          ${whereClause}
          GROUP BY eg.id
          ${orderByClause}
          LIMIT ${params.pageSize} OFFSET ${offset}
        `),
        tx.execute(sql`
          SELECT COUNT(*)::int AS total FROM (
            SELECT eg.id
            FROM ${errorOccurrences} eo
            JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
            ${whereClause}
            GROUP BY eg.id
          ) sub
        `),
      ]);

      const total = (countResult[0] as { total: number })?.total ?? 0;
      const groups = z.array(errorGroupSummarySchema).parse(rows);
      return buildPaginatedResponse(groups, total, params.page, params.pageSize);
    });
  }

  // ── Error Timeline ────────────────────────────────────────────

  async getErrorTimeline(
    organizationId: OrganizationId,
    params: ErrorTimelineParams,
  ): Promise<ErrorTimelineResponse> {
    const { dateFrom, dateTo } = resolveDateRange(params);
    const clampedTopN = clampTopN(params.topN);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const metricExpr = this.getMetricExpression(params.metric);
      const { searchFilter, categoryFilter } = this.buildFilters(params);
      const whereClause = this.buildOccurrencesWhereClause(
        params,
        dateFrom,
        dateTo,
        searchFilter,
        categoryFilter,
      );

      const topGroupsResult = await tx.execute(sql`
        SELECT eo.error_group_id AS "errorGroupId"
        FROM ${errorOccurrences} eo
        JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
        ${whereClause}
        GROUP BY eo.error_group_id
        ORDER BY ${metricExpr} DESC
        LIMIT ${clampedTopN}
      `);

      const topGroupIds = topGroupsResult.map((r) => (r as { errorGroupId: string }).errorGroupId);

      if (topGroupIds.length === 0) {
        return errorTimelineResponseSchema.parse({ series: [], otherSeries: [] });
      }

      const groupIdArray = sql`ARRAY[${sql.join(
        topGroupIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::uuid[]`;

      const dateToExclusive = new Date(dateTo.getTime() + MS_PER_DAY).toISOString();
      const branchFilter = params.branch ? sql`AND eo.branch = ${params.branch}` : sql``;

      const [seriesResult, otherResult] = await Promise.all([
        tx.execute(sql`
          SELECT
            eo.error_group_id AS "errorGroupId",
            eg.title,
            eg.error_name AS "errorName",
            DATE(eo.occurred_at)::text AS "date",
            COUNT(eo.id)::int AS occurrences,
            COUNT(DISTINCT eo.test_name)::int AS "uniqueTests",
            COUNT(DISTINCT eo.branch) FILTER (WHERE eo.branch IS NOT NULL)::int AS "uniqueBranches"
          FROM ${errorOccurrences} eo
          JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
          WHERE eg.project_id = ${params.projectId}
            AND eo.occurred_at >= ${dateFrom.toISOString()}
            AND eo.occurred_at < ${dateToExclusive}
            ${branchFilter}
            AND eo.error_group_id = ANY(${groupIdArray})
          GROUP BY eo.error_group_id, eg.title, eg.error_name, DATE(eo.occurred_at)
          ORDER BY "date" ASC, eo.error_group_id ASC
        `),
        tx.execute(sql`
          SELECT
            DATE(eo.occurred_at)::text AS "date",
            COUNT(eo.id)::int AS occurrences,
            COUNT(DISTINCT eo.test_name)::int AS "uniqueTests",
            COUNT(DISTINCT eo.branch) FILTER (WHERE eo.branch IS NOT NULL)::int AS "uniqueBranches"
          FROM ${errorOccurrences} eo
          JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
          WHERE eg.project_id = ${params.projectId}
            AND eo.occurred_at >= ${dateFrom.toISOString()}
            AND eo.occurred_at < ${dateToExclusive}
            ${branchFilter}
            AND eo.error_group_id != ALL(${groupIdArray})
          GROUP BY DATE(eo.occurred_at)
          ORDER BY "date" ASC
        `),
      ]);

      return errorTimelineResponseSchema.parse({
        series: this.assembleTimelineSeries(seriesResult as Record<string, unknown>[]),
        otherSeries: otherResult,
      });
    });
  }

  // ── Error Group Detail ────────────────────────────────────────

  async getErrorGroupDetail(
    organizationId: OrganizationId,
    params: ErrorGroupDetailParams,
  ): Promise<ErrorGroupDetail> {
    const { dateFrom, dateTo } = resolveDateRange(params);
    const dateToExclusive = new Date(dateTo.getTime() + MS_PER_DAY).toISOString();
    const dateFilter = sql`AND eo.occurred_at >= ${dateFrom.toISOString()} AND eo.occurred_at < ${dateToExclusive}`;

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
          WHERE eg.id = ${params.errorGroupId}
        `),
        tx.execute(sql`
          SELECT
            eo.test_name AS "testName",
            COUNT(eo.id)::int AS "occurrenceCount",
            MAX(eo.occurred_at)::text AS "lastSeenAt",
            (ARRAY_AGG(eo.run_id ORDER BY eo.occurred_at DESC))[1] AS "lastRunId",
            (ARRAY_AGG(eo.test_id ORDER BY eo.occurred_at DESC))[1] AS "lastTestId"
          FROM ${errorOccurrences} eo
          WHERE eo.error_group_id = ${params.errorGroupId}
            ${dateFilter}
          GROUP BY eo.test_name
          ORDER BY "occurrenceCount" DESC
          LIMIT ${DETAIL_AFFECTED_TESTS_LIMIT}
        `),
        tx.execute(sql`
          SELECT
            eo.branch,
            COUNT(eo.id)::int AS "occurrenceCount",
            MAX(eo.occurred_at)::text AS "lastSeenAt"
          FROM ${errorOccurrences} eo
          WHERE eo.error_group_id = ${params.errorGroupId}
            ${dateFilter}
          GROUP BY eo.branch
          ORDER BY "occurrenceCount" DESC
          LIMIT ${DETAIL_BRANCHES_LIMIT}
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
          WHERE eo.error_group_id = ${params.errorGroupId}
            ${dateFilter}
          ORDER BY eo.occurred_at DESC
          LIMIT ${DETAIL_EXECUTIONS_LIMIT}
        `),
      ]);

      const group = groupResult[0];
      if (!group) {
        throw new NotFoundException(`Error group ${params.errorGroupId} not found`);
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
}
