import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { WebhookAuthGuard } from '../src/guards/webhook-auth.guard';

const WEBHOOK_SECRET = 'a]pI0$h8?GxR5^Tf2Lw@m9Nz&kJ7dYq'; // 32+ chars to satisfy min(32)

function makeContext(headers: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as never;
}

describe('WebhookAuthGuard', () => {
  let guard: WebhookAuthGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WebhookAuthGuard,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: vi.fn().mockReturnValue(WEBHOOK_SECRET),
          },
        },
      ],
    }).compile();

    guard = module.get(WebhookAuthGuard);
  });

  it('returns true when the correct secret is provided', () => {
    const context = makeContext({ 'x-webhook-secret': WEBHOOK_SECRET });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws UnauthorizedException when x-webhook-secret header is missing', () => {
    const context = makeContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the secret is wrong', () => {
    const context = makeContext({ 'x-webhook-secret': 'wrong-secret-value-here-xxxxx' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects secrets with different lengths via short-circuit before timingSafeEqual', () => {
    const context = makeContext({ 'x-webhook-secret': 'short' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects secrets with matching length but different content', () => {
    const wrongSecret = 'x'.repeat(WEBHOOK_SECRET.length);
    const context = makeContext({ 'x-webhook-secret': wrongSecret });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
