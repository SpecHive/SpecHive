import { IS_PRODUCTION, throwZodBadRequest } from '@assertly/nestjs-common';
import { Controller, Get, Inject, Query } from '@nestjs/common';

import { paginationSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { ProjectsService } from './projects.service';

@Controller('v1/projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  @Get()
  async list(@CurrentUser() user: UserContext, @Query() query: Record<string, string>) {
    const result = paginationSchema.safeParse(query);
    if (!result.success) {
      throwZodBadRequest(result.error, 'Invalid pagination', this.isProduction);
    }
    return this.projectsService.listProjects(user.organizationId, result.data);
  }
}
