import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator, InternalServerErrorException } from '@nestjs/common';

import type { UserContext } from '../modules/auth/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.user) {
      throw new InternalServerErrorException('Missing user context — guard not applied');
    }
    return request.user as UserContext;
  },
);
