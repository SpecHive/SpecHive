import {
  createOutboxyModuleConfig,
  createS3ModuleOptions,
  DatabaseModule,
  GLOBAL_RATE_LIMIT_TTL_MS,
  HealthModule,
  IsProductionModule,
  S3Module,
  ThrottlerBehindProxyGuard,
} from '@assertly/nestjs-common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { OutboxyModule } from '@outboxy/sdk-nestjs';

import { ArtifactCleanupModule } from './modules/artifact-cleanup/artifact-cleanup.module';
import { ConfigModule } from './modules/config/config.module';
import type { EnvConfig } from './modules/config/env.validation';
import { ResultProcessorModule } from './modules/result-processor/result-processor.module';
import { RunCleanupModule } from './modules/run-cleanup/run-cleanup.module';
import { WebhookReceiverModule } from './modules/webhook-receiver/webhook-receiver.module';

const GLOBAL_RATE_LIMIT_MAX = 200;

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    IsProductionModule,
    ThrottlerModule.forRoot([
      {
        ttl: GLOBAL_RATE_LIMIT_TTL_MS,
        limit: GLOBAL_RATE_LIMIT_MAX,
      },
    ]),
    HealthModule,
    DatabaseModule.forRootFromEnv(),
    OutboxyModule.forRootAsync({
      useFactory: () => createOutboxyModuleConfig(),
      isGlobal: true,
    }),
    S3Module.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => createS3ModuleOptions(config),
      isGlobal: true,
    }),
    WebhookReceiverModule,
    ResultProcessorModule,
    RunCleanupModule,
    ArtifactCleanupModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }],
})
export class AppModule {}
