import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import type { ProjectId, RunId } from '@assertly/shared-types';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { paginationSchema, uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { RunsService } from './runs.service';

const listRunsSchema = paginationSchema.extend({
  projectId: z.string().uuid(),
  status: z.string().optional(),
});

@Controller('v1/runs')
export class RunsController {
  private readonly isProduction: boolean;

  constructor(
    private readonly runsService: RunsService,
    configService: ConfigService,
  ) {
    this.isProduction = isProductionEnv(configService);
  }

  @Get()
  async list(@CurrentUser() user: UserContext, @Query() query: Record<string, string>) {
    const result = listRunsSchema.safeParse(query);
    if (!result.success) throwZodBadRequest(result.error, 'Invalid request', this.isProduction);

    return this.runsService.listRuns(
      user.organizationId,
      result.data.projectId as ProjectId,
      { page: result.data.page, pageSize: result.data.pageSize },
      result.data.status,
    );
  }

  @Get(':id')
  async getById(@CurrentUser() user: UserContext, @Param('id') id: string) {
    const result = uuidSchema.safeParse(id);
    if (!result.success) throwZodBadRequest(result.error, 'Invalid request', this.isProduction);

    return this.runsService.getRunById(user.organizationId, result.data as RunId);
  }
}
