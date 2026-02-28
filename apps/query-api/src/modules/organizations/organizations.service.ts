import type { Database } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { MembershipRole, OrganizationId, UserId } from '@assertly/shared-types';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

type UserOrganization = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
};

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async getOrganizations(userId: UserId) {
    const orgs = await this.db.execute<UserOrganization>(
      sql`SELECT * FROM get_user_organizations(${userId}::uuid)`,
    );

    return orgs.map((o) => ({
      id: o.organization_id as OrganizationId,
      name: o.organization_name,
      slug: o.organization_slug,
      role: o.role as MembershipRole,
    }));
  }
}
