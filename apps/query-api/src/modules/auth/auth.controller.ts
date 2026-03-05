import { IS_PRODUCTION, throwZodBadRequest } from '@assertly/nestjs-common';
import type { OrganizationId } from '@assertly/shared-types';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public } from '../../decorators/public.decorator';

import { AuthService } from './auth.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import type { UserContext } from './types';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationId: z.string().uuid().optional(),
});

const switchOrgSchema = z.object({
  organizationId: z.string().uuid(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
  organizationId: z.string().uuid().optional(),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginRateLimit: LoginRateLimitService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Req() req: { body: unknown }) {
    const result = loginSchema.safeParse(req.body);
    if (!result.success)
      throwZodBadRequest(result.error, 'Invalid login payload', this.isProduction);

    const { email, password, organizationId } = result.data;

    if (this.loginRateLimit.isBlocked(email)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    try {
      const response = await this.authService.login(email, password, organizationId);
      this.loginRateLimit.recordSuccess(email);
      return response;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.loginRateLimit.recordFailure(email);
      }
      throw error;
    }
  }

  @Get('me')
  async me(@CurrentUser() user: UserContext) {
    const profile = await this.authService.getProfile(user.userId, user.organizationId);
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

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: { body: unknown }) {
    const result = refreshSchema.safeParse(req.body);
    if (!result.success)
      throwZodBadRequest(result.error, 'Invalid refresh payload', this.isProduction);

    return this.authService.refreshAccessToken(
      result.data.refreshToken,
      result.data.organizationId,
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: { body: unknown }) {
    const result = logoutSchema.safeParse(req.body);
    if (!result.success)
      throwZodBadRequest(result.error, 'Invalid logout payload', this.isProduction);

    await this.authService.logout(result.data.refreshToken);
  }
}
