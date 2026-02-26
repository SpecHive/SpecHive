import { createHmac } from 'node:crypto';

import type { Database } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { OrganizationId, ProjectId } from '@assertly/shared-types';
import { asOrganizationId, asProjectId } from '@assertly/shared-types';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI needs the class at runtime
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';

export interface ProjectContext {
  projectId: ProjectId;
  organizationId: OrganizationId;
}

@Injectable()
export class ProjectTokenGuard implements CanActivate {
  private readonly logger = new Logger(ProjectTokenGuard.name);

  private readonly tokenHashKey: string;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    configService: ConfigService,
  ) {
    this.tokenHashKey = configService.getOrThrow<string>('TOKEN_HASH_KEY');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawToken = request.headers['x-project-token'];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!token) {
      throw new UnauthorizedException('Missing x-project-token header');
    }

    const tokenHash = createHmac('sha256', this.tokenHashKey).update(token).digest('hex');

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
      .catch((err) => this.logger.warn('Failed to update token lastUsedAt', err));

    return true;
  }
}
