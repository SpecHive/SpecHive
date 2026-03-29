import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import {
  createLoggerModule,
  createS3ModuleOptions,
  DatabaseModule,
  GatewayTrustGuard,
  HealthModule,
  IsProductionModule,
  S3Module,
} from '@spechive/nestjs-common';

import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { ConfigModule } from './modules/config/config.module';
import type { EnvConfig } from './modules/config/env.validation';
import { IngestionModule } from './modules/ingestion/ingestion.module';

@Module({
  imports: [
    ConfigModule,
    createLoggerModule(),
    IsProductionModule,
    HealthModule,
    DatabaseModule.forRootFromEnv(),
    S3Module.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => createS3ModuleOptions(config),
      isGlobal: true,
    }),
    IngestionModule,
    ArtifactsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: GatewayTrustGuard }],
})
export class AppModule {}
