import { HealthModule } from '@assertly/nestjs-common';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ConfigModule } from './modules/config/config.module';
import { ResultProcessorModule } from './modules/result-processor/result-processor.module';
import { WebhookReceiverModule } from './modules/webhook-receiver/webhook-receiver.module';

const GLOBAL_RATE_LIMIT_TTL_MS = 60_000;
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
    WebhookReceiverModule,
    ResultProcessorModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
