import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { WebhookAuthGuard } from '../../guards/webhook-auth.guard';
import { OutboxyEnvelopeSchema } from '../../types/outboxy-envelope';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires value import
import { ResultProcessorService } from '../result-processor/result-processor.service';

@Controller('webhooks')
@UseGuards(WebhookAuthGuard)
export class WebhookReceiverController {
  private readonly logger = new Logger(WebhookReceiverController.name);

  constructor(private readonly resultProcessor: ResultProcessorService) {}

  @Post('outboxy')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async receiveOutboxyEvent(@Body() body: unknown) {
    const result = OutboxyEnvelopeSchema.safeParse(body);

    if (!result.success) {
      this.logger.warn(`Invalid webhook payload: ${JSON.stringify(result.error.flatten())}`);
      throw new BadRequestException({
        message: 'Invalid webhook payload',
        errors: result.error.flatten(),
      });
    }

    this.logger.log(`Received Outboxy webhook event: ${result.data.eventType}`);
    await this.resultProcessor.processEvent(result.data);
    return { received: true };
  }
}
