import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import { RunStatus } from '@spechive/shared-types';
import type { ProjectId, RunId } from '@spechive/shared-types';
import { z } from 'zod';

import { paginationSchema, uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';

import { RunsService } from './runs.service';

const listRunsSchema = paginationSchema.extend({
  projectIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').filter(Boolean) : undefined))
    .pipe(z.string().uuid().array().optional()),
  status: z.nativeEnum(RunStatus).optional(),
  search: z.string().max(200).optional(),
  branch: z.string().max(500).optional(),
  sortBy: z
    .enum(['status', 'name', 'totalTests', 'startedAt', 'finishedAt', 'createdAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

@Controller('v1/runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get()
  async list(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(listRunsSchema)) query: z.infer<typeof listRunsSchema>,
  ) {
    return this.runsService.listRuns(
      user.organizationId,
      query.projectIds as ProjectId[] | undefined,
      { page: query.page, pageSize: query.pageSize },
      query.status,
      query.search,
      query.sortBy,
      query.sortOrder,
      query.branch,
    );
  }

  @Get(':id')
  async getById(
    @CurrentUser() user: UserContext,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ) {
    return this.runsService.getRunById(user.organizationId, id as RunId);
  }
}
