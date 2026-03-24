import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@spechive/database';
import { setTenantContext, suites } from '@spechive/database';
import { DATABASE_CONNECTION } from '@spechive/nestjs-common';
import type { OrganizationId, RunId } from '@spechive/shared-types';
import { asc, eq } from 'drizzle-orm';

@Injectable()
export class SuitesService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async listSuitesByRunId(organizationId: OrganizationId, runId: RunId) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const rows = await tx
        .select({
          id: suites.id,
          name: suites.name,
          parentSuiteId: suites.parentSuiteId,
          createdAt: suites.createdAt,
        })
        .from(suites)
        .where(eq(suites.runId, runId))
        .orderBy(asc(suites.createdAt));

      return rows;
    });
  }
}
