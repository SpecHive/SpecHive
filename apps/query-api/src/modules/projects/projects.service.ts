import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Database } from '@spechive/database';
import { setTenantContext } from '@spechive/database';
import { projects } from '@spechive/database';
import { DATABASE_CONNECTION, extractPgError } from '@spechive/nestjs-common';
import type { OrganizationId } from '@spechive/shared-types';
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
  ): Promise<PaginatedResponse<{ id: string; name: string; createdAt: Date | null }>> {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const offset = getOffset(pagination.page, pagination.pageSize);

      const [rows, totalResult] = await Promise.all([
        tx
          .select({
            id: projects.id,
            name: projects.name,
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

  async createProject(organizationId: OrganizationId, dto: { name: string }) {
    try {
      return await this.db.transaction(async (tx) => {
        await setTenantContext(tx, organizationId);
        const [created] = await tx
          .insert(projects)
          .values({ organizationId, name: dto.name })
          .returning();
        return created;
      });
    } catch (err: unknown) {
      const pgErr = extractPgError(err);
      if (pgErr?.code === '23505') {
        throw new ConflictException('A project with this name already exists');
      }
      throw err;
    }
  }
}
