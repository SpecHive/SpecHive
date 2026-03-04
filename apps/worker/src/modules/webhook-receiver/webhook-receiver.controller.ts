import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

import { WebhookAuthGuard } from '../../guards/webhook-auth.guard';
import { OutboxyBatchSchema } from '../../types/outboxy-envelope';
import type { EnvConfig } from '../config/env.validation';
import { ResultProcessorService } from '../result-processor/result-processor.service';

const WEBHOOK_RATE_LIMIT_TTL_MS = 60_000;
const WEBHOOK_RATE_LIMIT_MAX = 1_000;

@Controller('webhooks')
@UseGuards(WebhookAuthGuard)
export class WebhookReceiverController {
  private readonly logger = new Logger(WebhookReceiverController.name);
  private readonly isProduction: boolean;

  constructor(
    private readonly resultProcessor: ResultProcessorService,
    configService: ConfigService<EnvConfig>,
  ) {
    this.isProduction = isProductionEnv(configService);
  }

  @Post('outboxy')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: WEBHOOK_RATE_LIMIT_TTL_MS, limit: WEBHOOK_RATE_LIMIT_MAX } })
  async receiveOutboxyEvent(@Body() body: unknown) {
    const result = OutboxyBatchSchema.safeParse(body);

    if (!result.success) {
      this.logger.warn('Invalid webhook payload received');
      this.logger.debug(`Validation details: ${JSON.stringify(result.error.flatten())}`);
      throwZodBadRequest(result.error, 'Invalid webhook payload', this.isProduction);
    }

    const { events } = result.data;

    const sortedEvents = this.resultProcessor.sortEventsByPriority(events);

    this.logger.log(`Received Outboxy batch: ${sortedEvents.length} events`);

    for (const event of sortedEvents) {
      this.logger.log(`Processing event: ${event.eventType}`);
      try {
        await this.resultProcessor.processEvent(event);
      } catch (error) {
        this.logger.error(
          `Failed to process event ${event.eventId} (${event.eventType}): ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return { received: true, processed: events.length };
  }
}
