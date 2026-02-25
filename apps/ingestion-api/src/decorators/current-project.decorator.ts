import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

import type { ProjectContext } from '../guards/project-token.guard';

export const CurrentProject = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.projectContext as ProjectContext;
  },
);
