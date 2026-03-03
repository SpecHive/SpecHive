import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import type { OrganizationId } from '@assertly/shared-types';
import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public } from '../../decorators/public.decorator';

import { AuthService } from './auth.service';
import type { UserContext } from './types';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationId: z.string().uuid().optional(),
});

const switchOrgSchema = z.object({
  organizationId: z.string().uuid(),
});

@Controller('v1/auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    this.isProduction = isProductionEnv(configService);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Req() req: { body: unknown }) {
    const result = loginSchema.safeParse(req.body);
    if (!result.success)
      throwZodBadRequest(result.error, 'Invalid login payload', this.isProduction);

    return this.authService.login(
      result.data.email,
      result.data.password,
      result.data.organizationId,
    );
  }

  @Get('me')
  async me(@CurrentUser() user: UserContext) {
    const profile = await this.authService.getProfile(user.userId);
    return {
      ...profile,
      organizationId: user.organizationId,
      role: user.role,
    };
  }

  @Get('organizations')
  async organizations(@CurrentUser() user: UserContext) {
    const orgs = await this.authService.getOrganizations(user.userId);
    return { data: orgs };
  }

  @Post('switch-organization')
  @HttpCode(200)
  async switchOrganization(@CurrentUser() user: UserContext, @Req() req: { body: unknown }) {
    const result = switchOrgSchema.safeParse(req.body);
    if (!result.success)
      throwZodBadRequest(result.error, 'Invalid switch-organization payload', this.isProduction);

    return this.authService.switchOrganization(
      user.userId,
      result.data.organizationId as OrganizationId,
    );
  }
}
