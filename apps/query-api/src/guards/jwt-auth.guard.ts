import type { MembershipRole, OrganizationId, UserId } from '@assertly/shared-types';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { jwtVerify } from 'jose';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { JwtPayload, UserContext } from '../modules/auth/types';
import type { EnvConfig } from '../modules/config/env.validation';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly secret: Uint8Array;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService<EnvConfig>,
  ) {
    this.secret = new TextEncoder().encode(config.getOrThrow<string>('JWT_SECRET'));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const { payload } = await jwtVerify(token, this.secret, { algorithms: ['HS256'] });
      const jwtPayload = payload as unknown as JwtPayload;

      const userContext: UserContext = {
        userId: jwtPayload.sub as UserId,
        organizationId: jwtPayload.organizationId as OrganizationId,
        role: jwtPayload.role as MembershipRole,
      };

      request.user = userContext;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
