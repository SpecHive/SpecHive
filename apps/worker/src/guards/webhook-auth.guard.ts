import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';

import type { EnvConfig } from '../modules/config/env.validation';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  private readonly webhookSecret: string;

  constructor(configService: ConfigService<EnvConfig>) {
    this.webhookSecret = configService.getOrThrow<string>('WEBHOOK_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-webhook-secret'] as string | undefined;

    if (!secret || secret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}
