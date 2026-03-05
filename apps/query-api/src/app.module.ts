import {
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
import { ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './modules/config/config.module';
import type { EnvConfig } from './modules/config/env.validation';
import { ProjectsModule } from './modules/projects/projects.module';
import { RunsModule } from './modules/runs/runs.module';
import { SuitesModule } from './modules/suites/suites.module';
import { TestsModule } from './modules/tests/tests.module';
import { TokensModule } from './modules/tokens/tokens.module';

const GLOBAL_RATE_LIMIT_MAX = 120;

@Module({
  imports: [
    ConfigModule,
    IsProductionModule,
    ThrottlerModule.forRoot([
      {
        ttl: GLOBAL_RATE_LIMIT_TTL_MS,
        limit: GLOBAL_RATE_LIMIT_MAX,
      },
    ]),
    HealthModule,
    DatabaseModule.forRootFromEnv(),
    S3Module.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => createS3ModuleOptions(config),
      isGlobal: true,
    }),
    AnalyticsModule,
    AuthModule,
    ProjectsModule,
    RunsModule,
    SuitesModule,
    TestsModule,
    TokensModule,
    ArtifactsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
