import { timingSafeEqual } from 'node:crypto';

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
    const rawSecret = request.headers['x-webhook-secret'];
    const secret = Array.isArray(rawSecret) ? rawSecret[0] : rawSecret;

    if (!secret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const secretBuf = Buffer.from(secret);
    const expectedBuf = Buffer.from(this.webhookSecret);
    const match =
      secretBuf.length === expectedBuf.length && timingSafeEqual(secretBuf, expectedBuf);

    if (!match) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}
