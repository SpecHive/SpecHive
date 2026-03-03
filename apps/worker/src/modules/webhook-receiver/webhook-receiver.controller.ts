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

const DEFAULT_EVENT_PRIORITY = 99;

// Event processing order (parents before children)
const EVENT_PRIORITY: Record<string, number> = {
  'run.start': 1,
  'suite.start': 2,
  'test.start': 3,
  'test.end': 4,
  'artifact.upload': 5,
  'suite.end': 6,
  'run.end': 7,
};

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

    // Sort events by dependency order (parents before children)
    const sortedEvents = [...events].sort(
      (a, b) =>
        (EVENT_PRIORITY[a.eventType] ?? DEFAULT_EVENT_PRIORITY) -
        (EVENT_PRIORITY[b.eventType] ?? DEFAULT_EVENT_PRIORITY),
    );

    this.logger.log(`Received Outboxy batch: ${sortedEvents.length} events`);

    for (const event of sortedEvents) {
      this.logger.log(`Processing event: ${event.eventType}`);
      await this.resultProcessor.processEvent(event);
    }

    return { received: true, processed: events.length };
  }
}
