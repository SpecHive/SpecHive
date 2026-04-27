import { Controller, Get, SetMetadata } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthIndicatorFunction } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { IS_PUBLIC_KEY } from '../constants';

import { DbHealthIndicator } from './indicators/db-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { S3HealthIndicator } from './indicators/s3-health.indicator';

@Controller('health')
@SkipThrottle()
@SetMetadata(IS_PUBLIC_KEY, true)
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly dbHealth: DbHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly s3Health: S3HealthIndicator,
  ) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  async ready() {
    const checks: HealthIndicatorFunction[] = [];

    if (this.dbHealth.isAvailable()) {
      checks.push(() => this.dbHealth.isHealthy('database'));
    }

    if (this.redisHealth.isAvailable()) {
      checks.push(() => this.redisHealth.isHealthy('redis'));
    }

    if (this.s3Health.isAvailable()) {
      checks.push(() => this.s3Health.isHealthy('storage'));
    }

    return this.health.check(checks);
  }
}
