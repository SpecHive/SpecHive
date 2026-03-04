import type { Database } from '@assertly/database';
import { runs, setTenantContext, suites } from '@assertly/database';
import { DATABASE_CONNECTION, escapeLikePattern } from '@assertly/nestjs-common';
import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';

import { buildPaginatedResponse, getOffset } from '../../common/pagination';
import type { PaginationParams } from '../../common/pagination';

@Injectable()
export class RunsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  private static readonly runsSortColumns = {
    status: runs.status,
    name: runs.name,
    totalTests: runs.totalTests,
    startedAt: runs.startedAt,
    finishedAt: runs.finishedAt,
    createdAt: runs.createdAt,
  } as const;

  async listRuns(
    organizationId: OrganizationId,
    projectId: ProjectId,
    pagination: PaginationParams,
    status?: string,
    search?: string,
    sortBy: keyof typeof RunsService.runsSortColumns = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const offset = getOffset(pagination.page, pagination.pageSize);

      const conditions = [eq(runs.projectId, projectId)];
      if (status) {
        conditions.push(eq(runs.status, status));
      }
      if (search) {
        conditions.push(ilike(runs.name, `%${escapeLikePattern(search)}%`));
      }

      const where = and(...conditions);
      const sortColumn = RunsService.runsSortColumns[sortBy];
      const orderFn = sortOrder === 'asc' ? asc : desc;

      const [rows, totalResult] = await Promise.all([
        tx
          .select({
            id: runs.id,
            projectId: runs.projectId,
            name: runs.name,
            status: runs.status,
            totalTests: runs.totalTests,
            passedTests: runs.passedTests,
            failedTests: runs.failedTests,
            skippedTests: runs.skippedTests,
            flakyTests: runs.flakyTests,
            startedAt: runs.startedAt,
            finishedAt: runs.finishedAt,
            createdAt: runs.createdAt,
          })
          .from(runs)
          .where(where)
          .orderBy(orderFn(sortColumn))
          .limit(pagination.pageSize)
          .offset(offset),
        tx.select({ count: count() }).from(runs).where(where),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return buildPaginatedResponse(rows, total, pagination.page, pagination.pageSize);
    });
  }

  async getRunById(organizationId: OrganizationId, runId: RunId) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const [rowResult, suiteCountResult] = await Promise.all([
        tx
          .select({
            id: runs.id,
            projectId: runs.projectId,
            name: runs.name,
            status: runs.status,
            totalTests: runs.totalTests,
            passedTests: runs.passedTests,
            failedTests: runs.failedTests,
            skippedTests: runs.skippedTests,
            flakyTests: runs.flakyTests,
            startedAt: runs.startedAt,
            finishedAt: runs.finishedAt,
            metadata: runs.metadata,
            createdAt: runs.createdAt,
            updatedAt: runs.updatedAt,
          })
          .from(runs)
          .where(eq(runs.id, runId))
          .limit(1),
        tx.select({ count: count() }).from(suites).where(eq(suites.runId, runId)),
      ]);

      const row = rowResult[0];
      if (!row) {
        throw new NotFoundException(`Run ${runId} not found`);
      }

      return {
        ...row,
        suiteCount: suiteCountResult[0]?.count ?? 0,
      };
    });
  }
}
