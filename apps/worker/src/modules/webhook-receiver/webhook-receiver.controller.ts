import { isProductionEnv } from '@assertly/nestjs-common';
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
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires value import
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { WebhookAuthGuard } from '../../guards/webhook-auth.guard';
import { OutboxyEnvelopeSchema } from '../../types/outboxy-envelope';
import type { EnvConfig } from '../config/env.validation';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- NestJS DI requires value import
import { ResultProcessorService } from '../result-processor/result-processor.service';

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
  @Throttle({ default: { ttl: 60_000, limit: 1_000 } })
  async receiveOutboxyEvent(@Body() body: unknown) {
    const result = OutboxyEnvelopeSchema.safeParse(body);

    if (!result.success) {
      if (this.isProduction) {
        this.logger.warn('Invalid webhook payload received');
        this.logger.debug(`Validation details: ${JSON.stringify(result.error.flatten())}`);
      } else {
        this.logger.warn(`Invalid webhook payload: ${JSON.stringify(result.error.flatten())}`);
      }
      const message = this.isProduction
        ? 'Invalid webhook payload'
        : `Invalid webhook payload: ${JSON.stringify(z.flattenError(result.error))}`;
      throw new BadRequestException({ message });
    }

    this.logger.log(`Received Outboxy webhook event: ${result.data.eventType}`);
    await this.resultProcessor.processEvent(result.data);
    return { received: true };
  }
}
