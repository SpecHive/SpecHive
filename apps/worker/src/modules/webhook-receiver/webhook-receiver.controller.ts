import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import { Body, Controller, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

import { WebhookAuthGuard } from '../../guards/webhook-auth.guard';
import { OutboxyEnvelopeSchema } from '../../types/outboxy-envelope';
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
    const result = OutboxyEnvelopeSchema.safeParse(body);

    if (!result.success) {
      this.logger.warn('Invalid webhook payload received');
      this.logger.debug(`Validation details: ${JSON.stringify(result.error.flatten())}`);
      throwZodBadRequest(result.error, 'Invalid webhook payload', this.isProduction);
    }

    this.logger.log(`Received Outboxy webhook event: ${result.data.eventType}`);
    await this.resultProcessor.processEvent(result.data);
    return { received: true };
  }
}
