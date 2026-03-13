import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Database } from '@spechive/database';
import { runs, setTenantContext, suites } from '@spechive/database';
import { DATABASE_CONNECTION, escapeLikePattern } from '@spechive/nestjs-common';
import type { OrganizationId, ProjectId, RunId } from '@spechive/shared-types';
import { RunStatus } from '@spechive/shared-types';
import { and, asc, count, desc, eq, ilike, isNotNull } from 'drizzle-orm';

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
    status?: RunStatus,
    search?: string,
    sortBy: keyof typeof RunsService.runsSortColumns = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    branch?: string,
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
      if (branch) {
        conditions.push(eq(runs.branch, branch));
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
            branch: runs.branch,
            commitSha: runs.commitSha,
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
            branch: runs.branch,
            commitSha: runs.commitSha,
            ciProvider: runs.ciProvider,
            ciUrl: runs.ciUrl,
            createdAt: runs.createdAt,
            updatedAt: runs.updatedAt,
          })
          .from(runs)
          .where(eq(runs.id, runId))
          .limit(1),
        // Exclude root-level suites (file suites with no parent) — project suites are skipped by the reporter
        tx
          .select({ count: count() })
          .from(suites)
          .where(and(eq(suites.runId, runId), isNotNull(suites.parentSuiteId))),
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
