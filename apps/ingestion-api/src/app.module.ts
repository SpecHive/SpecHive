import { HealthModule } from '@assertly/nestjs-common';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ConfigModule } from './modules/config/config.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';

const GLOBAL_RATE_LIMIT_TTL_MS = 60_000;
const GLOBAL_RATE_LIMIT_MAX = 60;

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
    IngestionModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
