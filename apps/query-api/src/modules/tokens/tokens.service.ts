import { randomBytes } from 'node:crypto';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Database } from '@spechive/database';
import { setTenantContext } from '@spechive/database';
import { projects, projectTokens } from '@spechive/database';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import type { OrganizationId, ProjectId, ProjectTokenId } from '@spechive/shared-types';
import { TOKEN_PLAIN_PREFIX, TOKEN_PREFIX_LENGTH } from '@spechive/shared-types';
import { hash } from 'argon2';
import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm';

import { buildPaginatedResponse, getOffset } from '../../common/pagination';
import type { PaginationParams } from '../../common/pagination';

@Injectable()
export class TokensService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async createToken(organizationId: OrganizationId, projectId: ProjectId, dto: { name: string }) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const plainToken = TOKEN_PLAIN_PREFIX + randomBytes(32).toString('hex');
      const tokenPrefix = plainToken.slice(0, TOKEN_PREFIX_LENGTH);
      const tokenHash = await hash(plainToken, { type: 2 });

      const [created] = await tx
        .insert(projectTokens)
        .values({
          projectId,
          organizationId,
          name: dto.name,
          tokenHash,
          tokenPrefix,
        })
        .returning({
          id: projectTokens.id,
          name: projectTokens.name,
          tokenPrefix: projectTokens.tokenPrefix,
          createdAt: projectTokens.createdAt,
        });

      return { ...created, token: plainToken };
    });
  }

  async listTokens(
    organizationId: OrganizationId,
    projectIds: ProjectId[] | undefined,
    pagination: PaginationParams,
    includeRevoked: boolean,
  ) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const offset = getOffset(pagination.page, pagination.pageSize);

      const projectCondition = projectIds?.length
        ? inArray(projectTokens.projectId, projectIds)
        : undefined;

      const activeCondition = includeRevoked ? undefined : isNull(projectTokens.revokedAt);

      const baseConditions =
        projectCondition && activeCondition
          ? and(projectCondition, activeCondition)
          : (projectCondition ?? activeCondition);

      const [rows, totalResult] = await Promise.all([
        tx
          .select({
            id: projectTokens.id,
            name: projectTokens.name,
            tokenPrefix: projectTokens.tokenPrefix,
            createdAt: projectTokens.createdAt,
            lastUsedAt: projectTokens.lastUsedAt,
            revokedAt: projectTokens.revokedAt,
            projectId: projectTokens.projectId,
            projectName: projects.name,
          })
          .from(projectTokens)
          .innerJoin(projects, eq(projectTokens.projectId, projects.id))
          .where(baseConditions)
          .orderBy(sql`${projectTokens.createdAt} DESC`)
          .limit(pagination.pageSize)
          .offset(offset),
        tx
          .select({ count: count() })
          .from(projectTokens)
          .innerJoin(projects, eq(projectTokens.projectId, projects.id))
          .where(baseConditions),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return buildPaginatedResponse(rows, total, pagination.page, pagination.pageSize);
    });
  }

  async revokeToken(organizationId: OrganizationId, tokenId: ProjectTokenId) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx
        .update(projectTokens)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(projectTokens.id, tokenId), isNull(projectTokens.revokedAt)))
        .returning({ id: projectTokens.id });

      if (result.length === 0) {
        throw new NotFoundException('Token not found or already revoked');
      }
    });
  }
}
