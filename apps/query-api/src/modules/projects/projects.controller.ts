import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import { z } from 'zod';

import { paginationSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { ProjectsService } from './projects.service';

const createProjectSchema = z.object({ name: z.string().trim().min(1).max(100) });

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

  @Post()
  async create(
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(createProjectSchema)) body: z.infer<typeof createProjectSchema>,
  ) {
    return this.projectsService.createProject(user.organizationId, body);
  }
}
