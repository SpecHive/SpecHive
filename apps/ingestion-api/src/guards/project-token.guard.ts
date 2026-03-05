import type { Database } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId, ProjectId } from '@assertly/shared-types';
import { TOKEN_PREFIX_LENGTH, asOrganizationId, asProjectId } from '@assertly/shared-types';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { verify } from 'argon2';
import { sql } from 'drizzle-orm';

export interface ProjectContext {
  projectId: ProjectId;
  organizationId: OrganizationId;
}

@Injectable()
export class ProjectTokenGuard implements CanActivate {
  private readonly logger = new Logger(ProjectTokenGuard.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawToken = request.headers['x-project-token'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!token) {
      throw new UnauthorizedException('Missing x-project-token header');
    }

    const tokenPrefix = token.slice(0, TOKEN_PREFIX_LENGTH);

    // Uses SECURITY DEFINER function to bypass RLS (org context is unknown at this point)
    const candidates = await this.db.execute<{
      token_hash: string;
      project_id: string;
      organization_id: string;
      revoked_at: string | null;
    }>(sql`SELECT * FROM validate_project_token_by_prefix(${tokenPrefix})`);

    if (candidates.length === 0) {
      throw new UnauthorizedException('Invalid or revoked project token');
    }

    let matchedRow: (typeof candidates)[0] | undefined;
    for (const candidate of candidates) {
      if (await verify(candidate.token_hash, token)) {
        matchedRow = candidate;
        break;
      }
    }

    if (!matchedRow) {
      throw new UnauthorizedException('Invalid or revoked project token');
    }

    // Defense-in-depth: catch regressions if SQL function's revoked_at filter is removed
    if (matchedRow.revoked_at) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const projectContext: ProjectContext = {
      projectId: asProjectId(matchedRow.project_id),
      organizationId: asOrganizationId(matchedRow.organization_id),
    };

    request.projectContext = projectContext;

    // Fire-and-forget lastUsedAt update via SECURITY DEFINER function
    this.db
      .execute(sql`SELECT touch_project_token_usage(${matchedRow.token_hash})`)
      .catch((err) => this.logger.warn('Failed to update token lastUsedAt', err));

    return true;
  }
}
