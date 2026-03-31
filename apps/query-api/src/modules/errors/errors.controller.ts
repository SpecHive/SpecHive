import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import { ERROR_CATEGORIES } from '@spechive/shared-types';
import type { ErrorGroupId, ProjectId } from '@spechive/shared-types';
import { z } from 'zod';

import { uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';

import {
  ERRORS_SEARCH_MAX_LENGTH,
  ERRORS_TOP_N_DEFAULT,
  ERRORS_TOP_N_MAX,
  ERRORS_TOP_N_MIN,
  UI_CATEGORY_OTHER,
} from './errors.constants';
import { ErrorsService } from './errors.service';

const commonFilterSchema = z.object({
  projectId: z.string().uuid(),
  dateFrom: z.coerce.number().int().positive().optional(),
  dateTo: z.coerce.number().int().positive().optional(),
  branch: z.string().max(500).optional(),
  search: z.string().max(ERRORS_SEARCH_MAX_LENGTH).optional(),
  category: z.enum([...ERROR_CATEGORIES, UI_CATEGORY_OTHER]).optional(),
});

function buildCommonParams(query: z.infer<typeof commonFilterSchema>) {
  return {
    projectId: query.projectId as ProjectId,
    ...(query.dateFrom != null && { dateFrom: new Date(query.dateFrom) }),
    ...(query.dateTo != null && { dateTo: new Date(query.dateTo) }),
    ...(query.branch != null && { branch: query.branch }),
    ...(query.search != null && { search: query.search }),
    ...(query.category != null && { category: query.category }),
  };
}

const listErrorsQuerySchema = commonFilterSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['occurrences', 'uniqueTests', 'uniqueBranches', 'lastSeenAt', 'title'])
    .default('occurrences'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const timelineQuerySchema = commonFilterSchema.extend({
  metric: z.enum(['occurrences', 'uniqueTests', 'uniqueBranches']).default('occurrences'),
  topN: z.coerce
    .number()
    .int()
    .min(ERRORS_TOP_N_MIN)
    .max(ERRORS_TOP_N_MAX)
    .default(ERRORS_TOP_N_DEFAULT),
});

const detailQuerySchema = z.object({
  dateFrom: z.coerce.number().int().positive().optional(),
  dateTo: z.coerce.number().int().positive().optional(),
});

@Controller('v1/errors')
export class ErrorsController {
  constructor(private readonly errorsService: ErrorsService) {}

  @Get()
  async list(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(listErrorsQuerySchema))
    query: z.infer<typeof listErrorsQuerySchema>,
  ) {
    return this.errorsService.listErrorGroups(user.organizationId, {
      ...buildCommonParams(query),
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  // Must be declared before :errorGroupId to prevent "timeline" matching as a param value
  @Get('timeline')
  async timeline(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(timelineQuerySchema))
    query: z.infer<typeof timelineQuerySchema>,
  ) {
    return this.errorsService.getErrorTimeline(user.organizationId, {
      ...buildCommonParams(query),
      metric: query.metric,
      topN: query.topN,
    });
  }

  @Get(':errorGroupId')
  async detail(
    @CurrentUser() user: UserContext,
    @Param('errorGroupId', new ZodValidationPipe(uuidSchema)) errorGroupId: string,
    @Query(new ZodValidationPipe(detailQuerySchema))
    query: z.infer<typeof detailQuerySchema>,
  ) {
    return this.errorsService.getErrorGroupDetail(user.organizationId, {
      errorGroupId: errorGroupId as ErrorGroupId,
      ...(query.dateFrom != null && { dateFrom: new Date(query.dateFrom) }),
      ...(query.dateTo != null && { dateTo: new Date(query.dateTo) }),
    });
  }
}
