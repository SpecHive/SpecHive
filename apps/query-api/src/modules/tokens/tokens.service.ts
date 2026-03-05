import { randomBytes } from 'node:crypto';

import type { Database } from '@assertly/database';
import { setTenantContext } from '@assertly/database';
import { projects, projectTokens } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId, ProjectId, ProjectTokenId } from '@assertly/shared-types';
import { TOKEN_PLAIN_PREFIX, TOKEN_PREFIX_LENGTH } from '@assertly/shared-types';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'argon2';
import { and, count, eq, isNull, sql } from 'drizzle-orm';

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
    projectId: ProjectId,
    pagination: PaginationParams,
    includeRevoked: boolean,
  ) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const [project] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const offset = getOffset(pagination.page, pagination.pageSize);

      const baseConditions = includeRevoked
        ? eq(projectTokens.projectId, projectId)
        : and(eq(projectTokens.projectId, projectId), isNull(projectTokens.revokedAt));

      const [rows, totalResult] = await Promise.all([
        tx
          .select({
            id: projectTokens.id,
            name: projectTokens.name,
            tokenPrefix: projectTokens.tokenPrefix,
            createdAt: projectTokens.createdAt,
            lastUsedAt: projectTokens.lastUsedAt,
            revokedAt: projectTokens.revokedAt,
          })
          .from(projectTokens)
          .where(baseConditions)
          .orderBy(sql`${projectTokens.createdAt} DESC`)
          .limit(pagination.pageSize)
          .offset(offset),
        tx.select({ count: count() }).from(projectTokens).where(baseConditions),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return buildPaginatedResponse(rows, total, pagination.page, pagination.pageSize);
    });
  }

  async revokeToken(organizationId: OrganizationId, projectId: ProjectId, tokenId: ProjectTokenId) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx
        .update(projectTokens)
        .set({ revokedAt: sql`now()` })
        .where(
          and(
            eq(projectTokens.id, tokenId),
            eq(projectTokens.projectId, projectId),
            isNull(projectTokens.revokedAt),
          ),
        )
        .returning({ id: projectTokens.id });

      if (result.length === 0) {
        throw new NotFoundException('Token not found or already revoked');
      }
    });
  }
}
