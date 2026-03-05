import { ZodValidationPipe } from '@assertly/nestjs-common';
import { RunStatus } from '@assertly/shared-types';
import type { ProjectId, RunId } from '@assertly/shared-types';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';

import { paginationSchema, uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { RunsService } from './runs.service';

const listRunsSchema = paginationSchema.extend({
  projectId: z.string().uuid(),
  status: z.nativeEnum(RunStatus).optional(),
  search: z.string().max(200).optional(),
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
      query.projectId as ProjectId,
      { page: query.page, pageSize: query.pageSize },
      query.status,
      query.search,
      query.sortBy,
      query.sortOrder,
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
