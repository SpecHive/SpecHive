import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';

import { ThrottlerBehindProxyGuard } from '../guards/throttler-behind-proxy.guard';
import { HealthModule } from '../health/health.module';

const TEST_THROTTLE_TTL_MS = 60_000;
const TEST_THROTTLE_LIMIT = 3;

@Controller('test-endpoint')
@Throttle({
  default: { ttl: TEST_THROTTLE_TTL_MS, limit: TEST_THROTTLE_LIMIT },
})
class TestThrottledController {
  @Get()
  handle() {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: TEST_THROTTLE_TTL_MS, limit: 10 }]), HealthModule],
  controllers: [TestThrottledController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }],
})
class TestAppModule {}

interface VitestApi {
  describe: (name: string, fn: () => void) => void;
  it: (name: string, fn: () => Promise<void>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect: (value: unknown) => any;
  beforeEach: (fn: () => Promise<void>) => void;
  afterEach: (fn: () => Promise<void>) => void;
}

export function createThrottleTestSuite(
  appLabel: string,
  { describe, it, expect, beforeEach, afterEach }: VitestApi,
): void {
  describe(`Rate Limiting (${appLabel})`, () => {
    let app: NestFastifyApplication;

    beforeEach(async () => {
      const moduleFixture = await Test.createTestingModule({
        imports: [TestAppModule],
      }).compile();

      app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
    });

    afterEach(async () => {
      await app.close();
    });

    it('allows requests within the throttle limit', async () => {
      for (let i = 0; i < TEST_THROTTLE_LIMIT; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/test-endpoint',
        });
        expect(response.statusCode).toBe(200);
      }
    });

    it('rejects requests exceeding the throttle limit with 429', async () => {
      for (let i = 0; i < TEST_THROTTLE_LIMIT; i++) {
        await app.inject({ method: 'GET', url: '/test-endpoint' });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/test-endpoint',
      });
      expect(response.statusCode).toBe(429);
    });

    it('includes rate limit headers in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test-endpoint',
      });

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('health endpoint bypasses throttling via @SkipThrottle()', async () => {
      for (let i = 0; i < 20; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/health',
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });
}
