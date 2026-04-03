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
  RolesGuard,
  S3Module,
} from '@spechive/nestjs-common';
import { RedisModule } from '@spechive/nestjs-common/redis';

import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './modules/config/config.module';
import type { EnvConfig } from './modules/config/env.validation';
import { ErrorsModule } from './modules/errors/errors.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MembersModule } from './modules/members/members.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RunsModule } from './modules/runs/runs.module';
import { SseModule } from './modules/sse/sse.module';
import { SuitesModule } from './modules/suites/suites.module';
import { TestsModule } from './modules/tests/tests.module';
import { TokensModule } from './modules/tokens/tokens.module';

@Module({
  imports: [
    ConfigModule,
    createLoggerModule(),
    IsProductionModule,
    HealthModule,
    DatabaseModule.forRootFromEnv(),
    RedisModule.forRootFromEnv(),
    S3Module.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => createS3ModuleOptions(config),
      isGlobal: true,
    }),
    AnalyticsModule,
    AuthModule,
    ErrorsModule,
    InvitationsModule,
    MembersModule,
    ProjectsModule,
    RunsModule,
    SseModule,
    SuitesModule,
    TestsModule,
    TokensModule,
    ArtifactsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: GatewayTrustGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
