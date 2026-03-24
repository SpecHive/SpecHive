import { Module } from '@nestjs/common';

import { ResultProcessorModule } from '../result-processor/result-processor.module';

import { WebhookReceiverController } from './webhook-receiver.controller';

@Module({
  imports: [ResultProcessorModule],
  controllers: [WebhookReceiverController],
})
export class WebhookReceiverModule {}
