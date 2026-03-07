import type { Database } from '@assertly/database';
import { artifacts, setTenantContext, testAttempts, tests } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId, RunId, SuiteId, TestId } from '@assertly/shared-types';
import { TestStatus } from '@assertly/shared-types';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm/sql';

import { buildPaginatedResponse, getOffset } from '../../common/pagination';
import type { PaginationParams } from '../../common/pagination';

@Injectable()
export class TestsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  /**
   * Recursively fetches all descendant suite IDs including the given suite.
   * Uses PostgreSQL recursive CTE for efficient traversal.
   */
  private async getDescendantSuiteIds(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    suiteId: SuiteId,
  ): Promise<SuiteId[]> {
    const result = await tx.execute(sql`
      WITH RECURSIVE suite_tree AS (
        SELECT id FROM suites WHERE id = ${suiteId}
        UNION ALL
        SELECT s.id FROM suites s
        INNER JOIN suite_tree st ON s.parent_suite_id = st.id
      )
      SELECT id FROM suite_tree
    `);
    return result.map((row) => row.id as SuiteId);
  }

  private static readonly testsSortColumns = {
    name: tests.name,
    status: tests.status,
    durationMs: tests.durationMs,
    createdAt: tests.createdAt,
  } as const;

  async listTests(
    organizationId: OrganizationId,
    runId: RunId,
    pagination: PaginationParams,
    status?: TestStatus,
    suiteId?: SuiteId,
    sortBy: keyof typeof TestsService.testsSortColumns = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'asc',
  ) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const offset = getOffset(pagination.page, pagination.pageSize);

      const conditions = [eq(tests.runId, runId)];
      if (status) conditions.push(eq(tests.status, status));
      if (suiteId) {
        const suiteIds = await this.getDescendantSuiteIds(tx, suiteId);
        conditions.push(inArray(tests.suiteId, suiteIds));
      }

      const where = and(...conditions);
      const sortColumn = TestsService.testsSortColumns[sortBy];
      const orderFn = sortOrder === 'asc' ? asc : desc;

      const [rows, totalResult] = await Promise.all([
        tx
          .select({
            id: tests.id,
            suiteId: tests.suiteId,
            runId: tests.runId,
            name: tests.name,
            status: tests.status,
            durationMs: tests.durationMs,
            errorMessage: tests.errorMessage,
            retryCount: tests.retryCount,
            startedAt: tests.startedAt,
            finishedAt: tests.finishedAt,
            createdAt: tests.createdAt,
          })
          .from(tests)
          .where(where)
          .orderBy(orderFn(sortColumn))
          .limit(pagination.pageSize)
          .offset(offset),
        tx.select({ count: count() }).from(tests).where(where),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return buildPaginatedResponse(rows, total, pagination.page, pagination.pageSize);
    });
  }

  async getTestById(organizationId: OrganizationId, runId: RunId, testId: TestId) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const [rowResult, testArtifacts, testAttemptRows] = await Promise.all([
        tx
          .select()
          .from(tests)
          .where(and(eq(tests.id, testId), eq(tests.runId, runId)))
          .limit(1),
        tx
          .select({
            id: artifacts.id,
            type: artifacts.type,
            name: artifacts.name,
            sizeBytes: artifacts.sizeBytes,
            mimeType: artifacts.mimeType,
            retryIndex: artifacts.retryIndex,
            createdAt: artifacts.createdAt,
          })
          .from(artifacts)
          .where(eq(artifacts.testId, testId)),
        tx
          .select({
            retryIndex: testAttempts.retryIndex,
            status: testAttempts.status,
            durationMs: testAttempts.durationMs,
            errorMessage: testAttempts.errorMessage,
            stackTrace: testAttempts.stackTrace,
          })
          .from(testAttempts)
          .where(eq(testAttempts.testId, testId))
          .orderBy(asc(testAttempts.retryIndex)),
      ]);

      const row = rowResult[0];
      if (!row) {
        throw new NotFoundException(`Test ${testId} not found`);
      }

      return {
        ...row,
        artifacts: testArtifacts,
        attempts: testAttemptRows,
      };
    });
  }
}
