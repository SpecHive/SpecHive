import type { Database } from '@assertly/database';
import { setTenantContext } from '@assertly/database';
import { memberships, users } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId } from '@assertly/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { asc, count, eq } from 'drizzle-orm';

import { buildPaginatedResponse, getOffset } from '../../common/pagination';
import type { PaginationParams } from '../../common/pagination';

@Injectable()
export class MembersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async listMembers(organizationId: OrganizationId, pagination: PaginationParams) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const offset = getOffset(pagination.page, pagination.pageSize);
      const condition = eq(memberships.organizationId, organizationId);

      const [rows, totalResult] = await Promise.all([
        tx
          .select({
            id: memberships.id,
            userId: memberships.userId,
            email: users.email,
            name: users.name,
            role: memberships.role,
            joinedAt: memberships.createdAt,
          })
          .from(memberships)
          .innerJoin(users, eq(memberships.userId, users.id))
          .where(condition)
          .orderBy(asc(memberships.createdAt))
          .limit(pagination.pageSize)
          .offset(offset),
        tx.select({ count: count() }).from(memberships).where(condition),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return buildPaginatedResponse(rows, total, pagination.page, pagination.pageSize);
    });
  }
}
