import { ZodValidationPipe } from '@assertly/nestjs-common';
import type { OrganizationId } from '@assertly/shared-types';
import { Body, Controller, Get, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public } from '../../decorators/public.decorator';

import { AuthService } from './auth.service';
import { LoginRateLimitService } from './login-rate-limit.service';
import type { UserContext } from './types';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100),
  organizationName: z.string().trim().min(1).max(255),
});

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
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: z.infer<typeof registerSchema>,
  ) {
    return this.authService.register(body.email, body.password, body.name, body.organizationName);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>) {
    const { email, password, organizationId } = body;

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
  async switchOrganization(
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(switchOrgSchema)) body: z.infer<typeof switchOrgSchema>,
  ) {
    return this.authService.switchOrganization(user.userId, body.organizationId as OrganizationId);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    return this.authService.refreshAccessToken(body.refreshToken, body.organizationId);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(logoutSchema)) body: z.infer<typeof logoutSchema>) {
    await this.authService.logout(body.refreshToken);
  }
}
