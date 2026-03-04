import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import type { ProjectId } from '@assertly/shared-types';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly isProduction: boolean;

  constructor(
    private readonly analyticsService: AnalyticsService,
    configService: ConfigService,
  ) {
    this.isProduction = isProductionEnv(configService);
  }

  @Get('summary')
  async getSummary(
    @CurrentUser() user: UserContext,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string>,
  ) {
    const paramResult = projectIdParamSchema.safeParse(projectId);
    if (!paramResult.success)
      throwZodBadRequest(paramResult.error, 'Invalid projectId', this.isProduction);

    const queryResult = trendQuerySchema.safeParse(query);
    if (!queryResult.success)
      throwZodBadRequest(queryResult.error, 'Invalid query parameters', this.isProduction);

    return this.analyticsService.getProjectSummary(
      user.organizationId,
      paramResult.data as ProjectId,
      queryResult.data.days,
    );
  }

  @Get('pass-rate-trend')
  async getPassRateTrend(
    @CurrentUser() user: UserContext,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string>,
  ) {
    const paramResult = projectIdParamSchema.safeParse(projectId);
    if (!paramResult.success)
      throwZodBadRequest(paramResult.error, 'Invalid projectId', this.isProduction);

    const queryResult = trendQuerySchema.safeParse(query);
    if (!queryResult.success)
      throwZodBadRequest(queryResult.error, 'Invalid query parameters', this.isProduction);

    return this.analyticsService.getPassRateTrend(
      user.organizationId,
      paramResult.data as ProjectId,
      queryResult.data.days,
    );
  }

  @Get('duration-trend')
  async getDurationTrend(
    @CurrentUser() user: UserContext,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string>,
  ) {
    const paramResult = projectIdParamSchema.safeParse(projectId);
    if (!paramResult.success)
      throwZodBadRequest(paramResult.error, 'Invalid projectId', this.isProduction);

    const queryResult = trendQuerySchema.safeParse(query);
    if (!queryResult.success)
      throwZodBadRequest(queryResult.error, 'Invalid query parameters', this.isProduction);

    return this.analyticsService.getDurationTrend(
      user.organizationId,
      paramResult.data as ProjectId,
      queryResult.data.days,
    );
  }

  @Get('flaky-tests')
  async getFlakyTests(
    @CurrentUser() user: UserContext,
    @Param('projectId') projectId: string,
    @Query() query: Record<string, string>,
  ) {
    const paramResult = projectIdParamSchema.safeParse(projectId);
    if (!paramResult.success)
      throwZodBadRequest(paramResult.error, 'Invalid projectId', this.isProduction);

    const queryResult = flakyQuerySchema.safeParse(query);
    if (!queryResult.success)
      throwZodBadRequest(queryResult.error, 'Invalid query parameters', this.isProduction);

    return this.analyticsService.getFlakyTests(
      user.organizationId,
      paramResult.data as ProjectId,
      queryResult.data.days,
      queryResult.data.limit,
    );
  }
}
