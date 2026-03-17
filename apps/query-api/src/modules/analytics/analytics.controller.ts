import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import type { ProjectId } from '@spechive/shared-types';
import { z } from 'zod';

import { CurrentUser } from '../../decorators/current-user.decorator';

import { ANALYTICS_MAX_DAYS, ANALYTICS_MAX_FLAKY_LIMIT } from './analytics.constants';
import { AnalyticsService } from './analytics.service';

const projectIdParamSchema = z.string().uuid();

const trendQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(ANALYTICS_MAX_DAYS).default(30),
});

const flakyQuerySchema = trendQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(ANALYTICS_MAX_FLAKY_LIMIT).default(10),
});

@Controller('v1/projects/:projectId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  async getSummary(
    @CurrentUser() user: UserContext,
    @Param('projectId', new ZodValidationPipe(projectIdParamSchema)) projectId: string,
    @Query(new ZodValidationPipe(trendQuerySchema)) query: z.infer<typeof trendQuerySchema>,
  ) {
    return this.analyticsService.getProjectSummary(
      user.organizationId,
      projectId as ProjectId,
      query.days,
    );
  }

  @Get('pass-rate-trend')
  async getPassRateTrend(
    @CurrentUser() user: UserContext,
    @Param('projectId', new ZodValidationPipe(projectIdParamSchema)) projectId: string,
    @Query(new ZodValidationPipe(trendQuerySchema)) query: z.infer<typeof trendQuerySchema>,
  ) {
    return this.analyticsService.getPassRateTrend(
      user.organizationId,
      projectId as ProjectId,
      query.days,
    );
  }

  @Get('duration-trend')
  async getDurationTrend(
    @CurrentUser() user: UserContext,
    @Param('projectId', new ZodValidationPipe(projectIdParamSchema)) projectId: string,
    @Query(new ZodValidationPipe(trendQuerySchema)) query: z.infer<typeof trendQuerySchema>,
  ) {
    return this.analyticsService.getDurationTrend(
      user.organizationId,
      projectId as ProjectId,
      query.days,
    );
  }

  @Get('flaky-tests')
  async getFlakyTests(
    @CurrentUser() user: UserContext,
    @Param('projectId', new ZodValidationPipe(projectIdParamSchema)) projectId: string,
    @Query(new ZodValidationPipe(flakyQuerySchema)) query: z.infer<typeof flakyQuerySchema>,
  ) {
    return this.analyticsService.getFlakyTests(
      user.organizationId,
      projectId as ProjectId,
      query.days,
      query.limit,
    );
  }
}
