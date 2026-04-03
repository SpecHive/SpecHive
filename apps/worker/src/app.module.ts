import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxyModule } from '@outboxy/sdk-nestjs';
import {
  createLoggerModule,
  createOutboxyModuleConfig,
  createS3ModuleOptions,
  DatabaseModule,
  HealthModule,
  IsProductionModule,
  S3Module,
} from '@spechive/nestjs-common';
import { RedisModule } from '@spechive/nestjs-common/redis';

import { ArtifactCleanupModule } from './modules/artifact-cleanup/artifact-cleanup.module';
import { ConfigModule } from './modules/config/config.module';
import type { EnvConfig } from './modules/config/env.validation';
import { ResultProcessorModule } from './modules/result-processor/result-processor.module';
import { RunCleanupModule } from './modules/run-cleanup/run-cleanup.module';
import { WebhookReceiverModule } from './modules/webhook-receiver/webhook-receiver.module';

@Module({
  imports: [
    ConfigModule,
    createLoggerModule(),
    ScheduleModule.forRoot(),
    IsProductionModule,
    HealthModule,
    DatabaseModule.forRootFromEnv(),
    RedisModule.forRootFromEnv(),
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
})
export class AppModule {}
