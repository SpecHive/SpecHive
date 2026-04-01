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

import type { ErrorSortField } from './errors.constants';
import {
  DETAIL_AFFECTED_TESTS_LIMIT,
  DETAIL_BRANCHES_LIMIT,
  ERRORS_MAX_DAYS,
  ERRORS_TOP_N_MAX,
  ERRORS_TOP_N_MIN,
  MS_PER_DAY,
  UI_CATEGORY_OTHER,
} from './errors.constants';

type SqlFragment = ReturnType<typeof sql>;
type ErrorMetric = 'occurrences' | 'uniqueTests' | 'uniqueBranches';

const timelineRowSchema = z.object({
  errorGroupId: z.string(),
  title: z.string(),
  errorName: z.string().nullable(),
  date: z.string(),
  occurrences: z.number(),
  uniqueTests: z.number(),
  uniqueBranches: z.number(),
});

interface ListErrorGroupsParams {
  projectId: ProjectId;
  dateFrom?: Date;
  dateTo?: Date;
  branch?: string;
  search?: string;
  category?: string;
  sortBy: ErrorSortField;
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
  const unclamped = params.dateFrom ?? new Date(now.getTime() - 30 * MS_PER_DAY);
  const dateFrom = new Date(Math.max(unclamped.getTime(), dateTo.getTime() - maxRange));
  const clamped = params.dateFrom != null && dateFrom.getTime() > unclamped.getTime();
  return { dateFrom, dateTo, clamped };
}

@Injectable()
export class ErrorsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  // ── Shared filter/sort helpers ──────────────────────────────────

  private static readonly sortColumns: Record<ErrorSortField, SqlFragment> = {
    occurrences: sql`"occurrences"`,
    uniqueTests: sql`"uniqueTests"`,
    uniqueBranches: sql`"uniqueBranches"`,
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
      ? params.category === UI_CATEGORY_OTHER
        ? sql`AND (eg.error_category IS NULL OR eg.error_category = 'runtime')`
        : sql`AND eg.error_category = ${params.category}`
      : sql``;

    return { searchFilter, categoryFilter };
  }

  private buildOrderByClause(sortBy: ErrorSortField, sortOrder: 'asc' | 'desc'): SqlFragment {
    const direction = sortOrder === 'asc' ? sql`ASC` : sql`DESC`;
    const column = ErrorsService.sortColumns[sortBy];
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
      const typed = timelineRowSchema.parse(row);
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
    return sql`
      WHERE eg.project_id = ${params.projectId}
        AND eo.occurred_at >= ${dateFrom.toISOString()}
        AND eo.occurred_at < ${dateTo.toISOString()}
        ${branchFilter}
        ${searchFilter}
        ${categoryFilter}
    `;
  }

  // ── List Error Groups ─────────────────────────────────────────

  async listErrorGroups(organizationId: OrganizationId, params: ListErrorGroupsParams) {
    const { dateFrom, dateTo, clamped } = resolveDateRange(params);

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
            COUNT(eo.id)::int AS "occurrences",
            COUNT(DISTINCT eo.test_name)::int AS "uniqueTests",
            COUNT(DISTINCT eo.branch) FILTER (WHERE eo.branch IS NOT NULL)::int AS "uniqueBranches",
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
      return {
        ...buildPaginatedResponse(groups, total, params.page, params.pageSize),
        dateRange: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
          clamped,
        },
      };
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
        return errorTimelineResponseSchema.parse({ series: [] });
      }

      const groupIdArray = sql`ARRAY[${sql.join(
        topGroupIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::uuid[]`;

      const branchFilter = params.branch ? sql`AND eo.branch = ${params.branch}` : sql``;

      // The series query intentionally omits search/category filters.
      // These filters are group-level (applied to eg.title, eg.error_category),
      // not occurrence-level. The rank query above already filtered group IDs
      // by search/category, so restricting by error_group_id here is equivalent.
      // NOTE: This assumption holds because all filters target error_groups columns.
      // If occurrence-level text filters are added, they must be applied here too.
      const seriesResult = await tx.execute(sql`
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
          AND eo.occurred_at < ${dateTo.toISOString()}
          ${branchFilter}
          AND eo.error_group_id = ANY(${groupIdArray})
        GROUP BY eo.error_group_id, eg.title, eg.error_name, DATE(eo.occurred_at)
        ORDER BY "date" ASC, eo.error_group_id ASC
      `);

      return errorTimelineResponseSchema.parse({
        series: this.assembleTimelineSeries(seriesResult as Record<string, unknown>[]),
      });
    });
  }

  // ── Error Group Detail ────────────────────────────────────────

  async getErrorGroupDetail(
    organizationId: OrganizationId,
    params: ErrorGroupDetailParams,
  ): Promise<ErrorGroupDetail> {
    const { dateFrom, dateTo } = resolveDateRange(params);
    const dateFilter = sql`AND eo.occurred_at >= ${dateFrom.toISOString()} AND eo.occurred_at < ${dateTo.toISOString()}`;

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      // Group metadata (firstSeenAt, lastSeenAt) is returned unscoped (all-time),
      // while affectedTests, affectedBranches, and latestMessage are scoped to dateFrom/dateTo.
      // This is intentional: users need to know when an error first appeared even in a narrow window.
      const [groupResult, testsResult, branchesResult, latestMessageResult] = await Promise.all([
        tx.execute(sql`
          SELECT
            eg.id,
            eg.project_id AS "projectId",
            eg.fingerprint,
            eg.title,
            eg.normalized_message AS "normalizedMessage",
            eg.error_name AS "errorName",
            eg.error_category AS "errorCategory",
            eg.first_seen_at::text AS "firstSeenAt",
            eg.last_seen_at::text AS "lastSeenAtAllTime",
            (
              SELECT MAX(eo2.occurred_at)::text
              FROM ${errorOccurrences} eo2
              WHERE eo2.error_group_id = eg.id
                AND eo2.organization_id = ${organizationId}
                ${dateFilter}
            ) AS "lastSeenAt",
            eg.created_at::text AS "createdAt",
            eg.updated_at::text AS "updatedAt"
          FROM ${errorGroups} eg
          WHERE eg.id = ${params.errorGroupId}
            AND eg.organization_id = ${organizationId}
        `),
        tx.execute(sql`
          SELECT
            eo.test_name AS "testName",
            COUNT(eo.id)::int AS "occurrenceCount",
            MAX(eo.occurred_at)::text AS "lastSeenAt",
            (ARRAY_AGG(eo.run_id ORDER BY eo.occurred_at DESC))[1] AS "lastRunId",
            (ARRAY_AGG(eo.test_id ORDER BY eo.occurred_at DESC))[1] AS "lastTestId",
            (ARRAY_AGG(eo.branch ORDER BY eo.occurred_at DESC))[1] AS "lastBranch"
          FROM ${errorOccurrences} eo
          WHERE eo.error_group_id = ${params.errorGroupId}
            AND eo.organization_id = ${organizationId}
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
            AND eo.organization_id = ${organizationId}
            ${dateFilter}
          GROUP BY eo.branch
          ORDER BY "occurrenceCount" DESC
          LIMIT ${DETAIL_BRANCHES_LIMIT}
        `),
        tx.execute(sql`
          SELECT eo.error_message AS "latestErrorMessage"
          FROM ${errorOccurrences} eo
          WHERE eo.error_group_id = ${params.errorGroupId}
            AND eo.organization_id = ${organizationId}
            ${dateFilter}
          ORDER BY eo.occurred_at DESC
          LIMIT 1
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
        latestErrorMessage:
          (latestMessageResult[0] as { latestErrorMessage: string | null } | undefined)
            ?.latestErrorMessage ?? null,
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
            eg.error_category AS "errorCategory",
            COUNT(eo.id)::int AS "occurrences"
          FROM ${errorOccurrences} eo
          JOIN ${errorGroups} eg ON eg.id = eo.error_group_id
          WHERE eo.run_id = ${runId}
            AND eo.organization_id = ${organizationId}
          GROUP BY eg.id, eg.title, eg.error_name, eg.error_category
          ORDER BY "occurrences" DESC
          LIMIT 5
        `),
        tx.execute(sql`
          SELECT
            COUNT(DISTINCT eo.error_group_id)::int AS "totalErrorGroups",
            COUNT(DISTINCT eo.test_id)::int AS "totalFailedTests"
          FROM ${errorOccurrences} eo
          WHERE eo.run_id = ${runId}
            AND eo.organization_id = ${organizationId}
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
