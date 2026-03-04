import { IS_PRODUCTION, throwZodBadRequest } from '@assertly/nestjs-common';
import type { ProjectId } from '@assertly/shared-types';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { z } from 'zod';

import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { AnalyticsService } from './analytics.service';

const projectIdParamSchema = z.string().uuid();

const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

const flakyQuerySchema = trendQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

@Controller('v1/projects/:projectId/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  private validateParams<T extends z.ZodType>(
    projectId: string,
    query: Record<string, string>,
    querySchema: T,
  ): { projectId: ProjectId; query: z.infer<T> } {
    const paramResult = projectIdParamSchema.safeParse(projectId);
    if (!paramResult.success)
      throwZodBadRequest(paramResult.error, 'Invalid projectId', this.isProduction);

    const queryResult = querySchema.safeParse(query);
    if (!queryResult.success)
      throwZodBadRequest(queryResult.error, 'Invalid query parameters', this.isProduction);

    return { projectId: paramResult.data as ProjectId, query: queryResult.data as z.infer<T> };
  }

  @Get('summary')
  async getSummary(
    @CurrentUser() user: UserContext,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string>,
  ) {
    const params = this.validateParams(projectId, query, trendQuerySchema);
    return this.analyticsService.getProjectSummary(
      user.organizationId,
      params.projectId,
      params.query.days,
    );
  }

  @Get('pass-rate-trend')
  async getPassRateTrend(
    @CurrentUser() user: UserContext,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string>,
  ) {
    const params = this.validateParams(projectId, query, trendQuerySchema);
    return this.analyticsService.getPassRateTrend(
      user.organizationId,
      params.projectId,
      params.query.days,
    );
  }

  @Get('duration-trend')
  async getDurationTrend(
    @CurrentUser() user: UserContext,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string>,
  ) {
    const params = this.validateParams(projectId, query, trendQuerySchema);
    return this.analyticsService.getDurationTrend(
      user.organizationId,
      params.projectId,
      params.query.days,
    );
  }

  @Get('flaky-tests')
  async getFlakyTests(
    @CurrentUser() user: UserContext,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string>,
  ) {
    const params = this.validateParams(projectId, query, flakyQuerySchema);
    return this.analyticsService.getFlakyTests(
      user.organizationId,
      params.projectId,
      params.query.days,
      params.query.limit,
    );
  }
}
