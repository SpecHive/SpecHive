import { ZodValidationPipe } from '@assertly/nestjs-common';
import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';

import { paginationSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { ProjectsService } from './projects.service';

@Controller('v1/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async list(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(paginationSchema)) query: z.infer<typeof paginationSchema>,
  ) {
    return this.projectsService.listProjects(user.organizationId, query);
  }
}
