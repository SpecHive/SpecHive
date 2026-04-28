import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { DbHealthIndicator } from './indicators/db-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';
import { S3HealthIndicator } from './indicators/s3-health.indicator';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DbHealthIndicator, RedisHealthIndicator, S3HealthIndicator],
})
export class HealthModule {}
