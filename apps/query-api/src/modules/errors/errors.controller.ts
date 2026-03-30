import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import type { ErrorGroupId } from '@spechive/shared-types';
import { z } from 'zod';

import { paginationSchema, uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';

import { ERRORS_TOP_N_MAX, ERRORS_TOP_N_MIN, ERRORS_TOP_N_DEFAULT } from './errors.constants';
import { ErrorsService } from './errors.service';

const categoryEnum = z.enum(['assertion', 'timeout', 'action', 'runtime']);

const listErrorsQuerySchema = paginationSchema.extend({
  projectId: z.string().uuid(),
  dateFrom: z.coerce.number().int().positive().optional(),
  dateTo: z.coerce.number().int().positive().optional(),
  branch: z.string().max(500).optional(),
  search: z.string().max(200).optional(),
  category: categoryEnum.optional(),
  sortBy: z
    .enum(['totalOccurrences', 'uniqueTestCount', 'uniqueBranchCount', 'lastSeenAt', 'title'])
    .default('totalOccurrences'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const timelineQuerySchema = z.object({
  projectId: z.string().uuid(),
  dateFrom: z.coerce.number().int().positive().optional(),
  dateTo: z.coerce.number().int().positive().optional(),
  branch: z.string().max(500).optional(),
  search: z.string().max(200).optional(),
  category: categoryEnum.optional(),
  metric: z.enum(['occurrences', 'uniqueTests', 'uniqueBranches']).default('occurrences'),
  topN: z.coerce
    .number()
    .int()
    .min(ERRORS_TOP_N_MIN)
    .max(ERRORS_TOP_N_MAX)
    .default(ERRORS_TOP_N_DEFAULT),
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
      projectId: query.projectId,
      ...(query.dateFrom != null && { dateFrom: new Date(query.dateFrom) }),
      ...(query.dateTo != null && { dateTo: new Date(query.dateTo) }),
      ...(query.branch != null && { branch: query.branch }),
      ...(query.search != null && { search: query.search }),
      ...(query.category != null && { category: query.category }),
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
      projectId: query.projectId,
      ...(query.dateFrom != null && { dateFrom: new Date(query.dateFrom) }),
      ...(query.dateTo != null && { dateTo: new Date(query.dateTo) }),
      ...(query.branch != null && { branch: query.branch }),
      ...(query.search != null && { search: query.search }),
      ...(query.category != null && { category: query.category }),
      metric: query.metric,
      topN: query.topN,
    });
  }

  @Get(':errorGroupId')
  async detail(
    @CurrentUser() user: UserContext,
    @Param('errorGroupId', new ZodValidationPipe(uuidSchema)) errorGroupId: string,
  ) {
    return this.errorsService.getErrorGroupDetail(
      user.organizationId,
      errorGroupId as ErrorGroupId,
    );
  }
}
