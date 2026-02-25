import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ConfigModule } from './modules/config/config.module';
import { HealthModule } from './modules/health/health.module';
import { ResultProcessorModule } from './modules/result-processor/result-processor.module';
import { WebhookReceiverModule } from './modules/webhook-receiver/webhook-receiver.module';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 200,
      },
    ]),
    HealthModule,
    WebhookReceiverModule,
    ResultProcessorModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
