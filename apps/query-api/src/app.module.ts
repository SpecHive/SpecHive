import { createDbConnection } from '@assertly/database';
import {
  DATABASE_CONNECTION,
  GLOBAL_RATE_LIMIT_TTL_MS,
  HealthModule,
  S3Module,
  ThrottlerBehindProxyGuard,
} from '@assertly/nestjs-common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ArtifactsModule } from './modules/artifacts/artifacts.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './modules/config/config.module';
import type { EnvConfig } from './modules/config/env.validation';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RunsModule } from './modules/runs/runs.module';
import { TestsModule } from './modules/tests/tests.module';

const GLOBAL_RATE_LIMIT_MAX = 120;

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([
      {
        ttl: GLOBAL_RATE_LIMIT_TTL_MS,
        limit: GLOBAL_RATE_LIMIT_MAX,
      },
    ]),
    HealthModule,
    S3Module.forRootAsync({
      inject: [ConfigService],
      useFactory: (...args: unknown[]) => {
        const config = args[0] as ConfigService<EnvConfig>;
        return {
          endpoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
          region: 'us-east-1',
          accessKeyId: config.getOrThrow<string>('MINIO_APP_ACCESS_KEY'),
          secretAccessKey: config.getOrThrow<string>('MINIO_APP_SECRET_KEY'),
          useSSL: config.getOrThrow<string>('MINIO_USE_SSL') === 'true',
          bucket: config.getOrThrow<string>('MINIO_BUCKET'),
        };
      },
      isGlobal: true,
    }),
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
    RunsModule,
    TestsModule,
    ArtifactsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    {
      provide: DATABASE_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => {
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
        return createDbConnection(databaseUrl);
      },
    },
  ],
})
export class AppModule {}
