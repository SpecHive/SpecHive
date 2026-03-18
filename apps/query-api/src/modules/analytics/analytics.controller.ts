import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import type { ProjectId } from '@spechive/shared-types';
import { z } from 'zod';

import { CurrentUser } from '../../decorators/current-user.decorator';

import { ANALYTICS_MAX_DAYS, ANALYTICS_MAX_FLAKY_LIMIT } from './analytics.constants';
import { AnalyticsService } from './analytics.service';

const trendQuerySchema = z.object({
  projectIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').filter(Boolean) : undefined))
    .pipe(z.string().uuid().array().optional()),
  days: z.coerce.number().int().min(1).max(ANALYTICS_MAX_DAYS).default(30),
});

const flakyQuerySchema = trendQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(ANALYTICS_MAX_FLAKY_LIMIT).default(10),
});

const comparisonQuerySchema = trendQuerySchema;

@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  async getSummary(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(trendQuerySchema)) query: z.infer<typeof trendQuerySchema>,
  ) {
    return this.analyticsService.getOrganizationSummary(
      user.organizationId,
      query.days,
      query.projectIds as ProjectId[] | undefined,
    );
  }

  @Get('pass-rate-trend')
  async getPassRateTrend(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(trendQuerySchema)) query: z.infer<typeof trendQuerySchema>,
  ) {
    return this.analyticsService.getOrganizationPassRateTrend(
      user.organizationId,
      query.days,
      query.projectIds as ProjectId[] | undefined,
    );
  }

  @Get('duration-trend')
  async getDurationTrend(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(trendQuerySchema)) query: z.infer<typeof trendQuerySchema>,
  ) {
    return this.analyticsService.getOrganizationDurationTrend(
      user.organizationId,
      query.days,
      query.projectIds as ProjectId[] | undefined,
    );
  }

  @Get('flaky-tests')
  async getFlakyTests(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(flakyQuerySchema)) query: z.infer<typeof flakyQuerySchema>,
  ) {
    return this.analyticsService.getOrganizationFlakyTests(
      user.organizationId,
      query.days,
      query.limit,
      query.projectIds as ProjectId[] | undefined,
    );
  }

  @Get('project-comparison')
  async getProjectComparison(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(comparisonQuerySchema))
    query: z.infer<typeof comparisonQuerySchema>,
  ) {
    return this.analyticsService.getProjectComparison(
      user.organizationId,
      query.days,
      query.projectIds as ProjectId[] | undefined,
    );
  }
}
