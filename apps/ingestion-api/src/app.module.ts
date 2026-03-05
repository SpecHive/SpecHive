import {
  DatabaseModule,
  GLOBAL_RATE_LIMIT_TTL_MS,
  HealthModule,
  IsProductionModule,
  ThrottlerBehindProxyGuard,
} from '@assertly/nestjs-common';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { ConfigModule } from './modules/config/config.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';

const GLOBAL_RATE_LIMIT_MAX = 60;

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
    IngestionModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }],
})
export class AppModule {}
