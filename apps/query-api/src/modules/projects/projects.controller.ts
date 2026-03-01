import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import { Controller, Get, Query, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { paginationSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { ProjectsService } from './projects.service';

@Controller('v1/projects')
export class ProjectsController {
  private readonly isProduction: boolean;

  constructor(
    private readonly projectsService: ProjectsService,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {
    this.isProduction = isProductionEnv(this.configService);
  }

  @Get()
  async list(@CurrentUser() user: UserContext, @Query() query: Record<string, string>) {
    const result = paginationSchema.safeParse(query);
    if (!result.success) {
      throwZodBadRequest(result.error, 'Invalid pagination', this.isProduction);
    }
    return this.projectsService.listProjects(user.organizationId, result.data);
  }
}
