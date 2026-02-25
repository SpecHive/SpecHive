import { Module } from '@nestjs/common';

import { ConfigModule } from './modules/config/config.module';
import { HealthModule } from './modules/health/health.module';
import { ResultProcessorModule } from './modules/result-processor/result-processor.module';
import { WebhookReceiverModule } from './modules/webhook-receiver/webhook-receiver.module';

@Module({
  imports: [ConfigModule, HealthModule, WebhookReceiverModule, ResultProcessorModule],
})
export class AppModule {}
