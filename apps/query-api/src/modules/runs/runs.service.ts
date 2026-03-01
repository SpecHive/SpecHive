import type { Database } from '@assertly/database';
import { runs, setTenantContext, suites } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';

import { buildPaginatedResponse, getOffset } from '../../common/pagination';
import type { PaginationParams } from '../../common/pagination';

@Injectable()
export class RunsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async listRuns(
    organizationId: OrganizationId,
    projectId: ProjectId,
    pagination: PaginationParams,
    status?: string,
  ) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const offset = getOffset(pagination.page, pagination.pageSize);

      const conditions = [eq(runs.projectId, projectId)];
      if (status) {
        conditions.push(eq(runs.status, status));
      }

      const where = and(...conditions);

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
            startedAt: runs.startedAt,
            finishedAt: runs.finishedAt,
            createdAt: runs.createdAt,
          })
          .from(runs)
          .where(where)
          .orderBy(desc(runs.createdAt))
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

      const [row] = await tx
        .select({
          id: runs.id,
          projectId: runs.projectId,
          name: runs.name,
          status: runs.status,
          totalTests: runs.totalTests,
          passedTests: runs.passedTests,
          failedTests: runs.failedTests,
          skippedTests: runs.skippedTests,
          startedAt: runs.startedAt,
          finishedAt: runs.finishedAt,
          metadata: runs.metadata,
          createdAt: runs.createdAt,
          updatedAt: runs.updatedAt,
        })
        .from(runs)
        .where(eq(runs.id, runId))
        .limit(1);

      if (!row) {
        throw new NotFoundException(`Run ${runId} not found`);
      }

      const [suiteCountResult] = await tx
        .select({ count: count() })
        .from(suites)
        .where(eq(suites.runId, runId));

      return {
        ...row,
        suiteCount: suiteCountResult?.count ?? 0,
      };
    });
  }
}
