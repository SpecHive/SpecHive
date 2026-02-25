import { createHash } from 'node:crypto';

import { projectTokens, projects } from '@assertly/database';
import type { Database } from '@assertly/database';
import type { OrganizationId, ProjectId } from '@assertly/shared-types';
import { asOrganizationId, asProjectId } from '@assertly/shared-types';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../modules/ingestion/ingestion.service';

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

    const rows = await this.db
      .select({
        projectId: projectTokens.projectId,
        organizationId: projects.organizationId,
      })
      .from(projectTokens)
      .innerJoin(projects, eq(projectTokens.projectId, projects.id))
      .where(and(eq(projectTokens.tokenHash, tokenHash), isNull(projectTokens.revokedAt)))
      .limit(1);

    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid or revoked project token');
    }

    const projectContext: ProjectContext = {
      projectId: asProjectId(rows[0]!.projectId),
      organizationId: asOrganizationId(rows[0]!.organizationId),
    };

    request.projectContext = projectContext;

    // Fire-and-forget lastUsedAt update — intentionally not awaited
    this.db
      .update(projectTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(projectTokens.tokenHash, tokenHash))
      .then(() => {})
      .catch(() => {});

    return true;
  }
}
