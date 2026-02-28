import type { Database } from '@assertly/database';
import { setTenantContext } from '@assertly/database';
import { projects } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId } from '@assertly/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { asc, count } from 'drizzle-orm';

import { buildPaginatedResponse, getOffset } from '../../common/pagination';
import type { PaginatedResponse, PaginationParams } from '../../common/pagination';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async listProjects(
    organizationId: OrganizationId,
    pagination: PaginationParams,
  ): Promise<
    PaginatedResponse<{ id: string; name: string; slug: string; createdAt: Date | null }>
  > {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const offset = getOffset(pagination.page, pagination.pageSize);

      const [rows, totalResult] = await Promise.all([
        tx
          .select({
            id: projects.id,
            name: projects.name,
            slug: projects.slug,
            createdAt: projects.createdAt,
          })
          .from(projects)
          .orderBy(asc(projects.name))
          .limit(pagination.pageSize)
          .offset(offset),
        tx.select({ count: count() }).from(projects),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return buildPaginatedResponse(rows, total, pagination.page, pagination.pageSize);
    });
  }
}
