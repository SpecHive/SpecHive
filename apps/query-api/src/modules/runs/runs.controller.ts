import { IS_PRODUCTION, throwZodBadRequest } from '@assertly/nestjs-common';
import { RunStatus } from '@assertly/shared-types';
import type { ProjectId, RunId } from '@assertly/shared-types';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
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
  constructor(
    private readonly runsService: RunsService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  @Get()
  async list(@CurrentUser() user: UserContext, @Query() query: Record<string, string>) {
    const result = listRunsSchema.safeParse(query);
    if (!result.success) throwZodBadRequest(result.error, 'Invalid request', this.isProduction);

    return this.runsService.listRuns(
      user.organizationId,
      result.data.projectId as ProjectId,
      { page: result.data.page, pageSize: result.data.pageSize },
      result.data.status,
      result.data.search,
      result.data.sortBy,
      result.data.sortOrder,
    );
  }

  @Get(':id')
  async getById(@CurrentUser() user: UserContext, @Param('id') id: string) {
    const result = uuidSchema.safeParse(id);
    if (!result.success) throwZodBadRequest(result.error, 'Invalid request', this.isProduction);

    return this.runsService.getRunById(user.organizationId, result.data as RunId);
  }
}
