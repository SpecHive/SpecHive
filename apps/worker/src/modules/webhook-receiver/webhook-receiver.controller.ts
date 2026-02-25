import { Body, Controller, HttpCode, HttpStatus, Post, Logger } from '@nestjs/common';

import type { ResultProcessorService } from '../result-processor/result-processor.service';

@Controller('webhooks')
export class WebhookReceiverController {
  private readonly logger = new Logger(WebhookReceiverController.name);

  constructor(private readonly resultProcessor: ResultProcessorService) {}

  @Post('outboxy')
  @HttpCode(HttpStatus.OK)
  receiveOutboxyEvent(@Body() payload: unknown) {
    this.logger.log('Received Outboxy webhook event');
    this.resultProcessor.processEvent(payload);
    return { received: true };
  }
}
