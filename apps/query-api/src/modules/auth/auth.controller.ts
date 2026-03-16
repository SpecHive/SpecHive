import '@fastify/cookie';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe, parseExpirySeconds } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import type { OrganizationId } from '@spechive/shared-types';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public } from '../../decorators/public.decorator';
import type { EnvConfig } from '../config/env.validation';

import { AuthService } from './auth.service';
import { LoginRateLimitService } from './login-rate-limit.service';

const COOKIE_NAME = 'spechive_rt';

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    name: z.string().trim().min(1).max(100),
    organizationName: z.string().trim().min(1).max(255).optional(),
    inviteToken: z.string().min(1).optional(),
  })
  .refine((data) => data.inviteToken || data.organizationName, {
    message: 'Organization name is required',
    path: ['organizationName'],
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
  organizationId: z.string().uuid().optional(),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

@Controller('v1/auth')
export class AuthController {
  private readonly isProduction: boolean;
  private readonly refreshMaxAgeSec: number;

  constructor(
    private readonly authService: AuthService,
    private readonly loginRateLimit: LoginRateLimitService,
    config: ConfigService<EnvConfig>,
  ) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
    this.refreshMaxAgeSec = parseExpirySeconds(
      config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
  }

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: z.infer<typeof registerSchema>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = body.inviteToken
      ? await this.authService.registerWithInvite(
          body.email,
          body.password,
          body.name,
          body.inviteToken,
        )
      : await this.authService.register(
          body.email,
          body.password,
          body.name,
          body.organizationName!,
        );
    this.setRefreshCookie(reply, result.refreshToken);
    const { refreshToken: _, ...rest } = result;
    return rest;
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { email, password, organizationId } = body;

    if (this.loginRateLimit.isBlocked(email)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    try {
      const result = await this.authService.login(email, password, organizationId);
      this.loginRateLimit.recordSuccess(email);
      this.setRefreshCookie(reply, result.refreshToken);
      const { refreshToken: _, ...rest } = result;
      return rest;
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
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const currentRefreshToken = request.cookies[COOKIE_NAME];
    const result = await this.authService.switchOrganization(
      user.userId,
      body.organizationId as OrganizationId,
      currentRefreshToken,
    );
    this.setRefreshCookie(reply, result.refreshToken);
    const { refreshToken: _, ...rest } = result;
    return rest;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: FastifyRequest,
    @Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const refreshToken = request.cookies[COOKIE_NAME];
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const result = await this.authService.refreshAccessToken(refreshToken, body.organizationId);
    this.setRefreshCookie(reply, result.refreshToken);
    const { refreshToken: _, ...rest } = result;
    return rest;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const refreshToken = request.cookies[COOKIE_NAME];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.clearRefreshCookie(reply);
  }

  @Patch('profile')
  @HttpCode(200)
  async updateProfile(
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: z.infer<typeof updateProfileSchema>,
  ) {
    await this.authService.updateProfile(user.userId, user.organizationId, body.name);
    const profile = await this.authService.getProfile(user.userId, user.organizationId);
    return {
      ...profile,
      organizationId: user.organizationId,
      role: user.role,
    };
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: z.infer<typeof changePasswordSchema>,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.authService.changePassword(
      user.userId,
      user.organizationId,
      body.currentPassword,
      body.newPassword,
    );
    this.clearRefreshCookie(reply);
    return { message: 'Password changed successfully' };
  }

  private setRefreshCookie(reply: FastifyReply, token: string): void {
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/v1/auth',
      maxAge: this.refreshMaxAgeSec,
    });
  }

  private clearRefreshCookie(reply: FastifyReply): void {
    reply.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      path: '/v1/auth',
    });
  }
}
