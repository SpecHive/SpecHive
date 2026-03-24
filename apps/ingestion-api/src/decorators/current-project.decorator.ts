import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, InternalServerErrorException } from '@nestjs/common';
import type { ProjectContext } from '@spechive/nestjs-common';

export const CurrentProject = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectContext => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.projectContext) {
      throw new InternalServerErrorException('Missing project context — guard not applied');
    }
    return request.projectContext as ProjectContext;
  },
);
