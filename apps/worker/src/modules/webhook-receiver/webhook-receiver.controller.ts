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
import { z } from 'zod';

import { WebhookAuthGuard } from '../../guards/webhook-auth.guard';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ResultProcessorService } from '../result-processor/result-processor.service';

const OutboxyEnvelopeSchema = z.object({
  id: z.string(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  eventType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().optional(),
});

export type OutboxyEnvelope = z.infer<typeof OutboxyEnvelopeSchema>;

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
