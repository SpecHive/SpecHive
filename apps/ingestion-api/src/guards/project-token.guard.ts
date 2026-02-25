import { createHash } from 'node:crypto';

import type { Database } from '@assertly/database';
import type { OrganizationId, ProjectId } from '@assertly/shared-types';
import { asOrganizationId, asProjectId } from '@assertly/shared-types';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../constants';

export interface ProjectContext {
  projectId: ProjectId;
  organizationId: OrganizationId;
}

@Injectable()
export class ProjectTokenGuard implements CanActivate {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-project-token'] as string | undefined;

    if (!token) {
      throw new UnauthorizedException('Missing x-project-token header');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Uses SECURITY DEFINER function to bypass RLS (org context is unknown at this point)
    const rows = await this.db.execute<{ project_id: string; organization_id: string }>(
      sql`SELECT * FROM validate_project_token(${tokenHash})`,
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid or revoked project token');
    }

    const projectContext: ProjectContext = {
      projectId: asProjectId(rows[0]!.project_id),
      organizationId: asOrganizationId(rows[0]!.organization_id),
    };

    request.projectContext = projectContext;

    // Fire-and-forget lastUsedAt update via SECURITY DEFINER function
    this.db
      .execute(sql`SELECT touch_project_token_usage(${tokenHash})`)
      .then(() => {})
      .catch(() => {});

    return true;
  }
}
