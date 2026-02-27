import { timingSafeEqual } from 'node:crypto';

import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { EnvConfig } from '../modules/config/env.validation';

// TODO: Upgrade to HMAC-SHA256 signature verification (x-webhook-signature header)
// once Outboxy supports signing outbound HTTP payloads. The current approach uses a
// static shared secret (x-webhook-secret) because Outboxy's HTTP publisher does not
// support HMAC natively — it would require either Outboxy adding signing support or
// an intermediate proxy that computes the signature.
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
