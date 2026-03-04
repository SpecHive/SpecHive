import { createDbConnection } from '@assertly/database';
import {
  createOutboxyAdapter,
  createS3ModuleOptions,
  DatabaseModule,
  GLOBAL_RATE_LIMIT_TTL_MS,
  HealthModule,
  S3Module,
  ThrottlerBehindProxyGuard,
} from '@assertly/nestjs-common';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PostgreSqlDialect, PostgreSqlInboxDialect } from '@outboxy/dialect-postgres';
import { OutboxyModule } from '@outboxy/sdk-nestjs';

import { ArtifactCleanupModule } from './modules/artifact-cleanup/artifact-cleanup.module';
import { ConfigModule } from './modules/config/config.module';
import type { EnvConfig } from './modules/config/env.validation';
import { ResultProcessorModule } from './modules/result-processor/result-processor.module';
import { WebhookReceiverModule } from './modules/webhook-receiver/webhook-receiver.module';

const GLOBAL_RATE_LIMIT_MAX = 200;

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
    DatabaseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => {
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');
        return createDbConnection(databaseUrl);
      },
    }),
    OutboxyModule.forRootAsync({
      useFactory: () => ({
        dialect: new PostgreSqlDialect(),
        adapter: createOutboxyAdapter(),
        inbox: {
          enabled: true,
          dialect: new PostgreSqlInboxDialect(),
        },
      }),
      isGlobal: true,
    }),
    S3Module.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => createS3ModuleOptions(config),
      isGlobal: true,
    }),
    WebhookReceiverModule,
    ResultProcessorModule,
    ArtifactCleanupModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }],
})
export class AppModule {}
