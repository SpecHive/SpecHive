import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IS_PRODUCTION, throwZodBadRequest } from '@spechive/nestjs-common';

import { WebhookAuthGuard } from '../../guards/webhook-auth.guard';
import { OutboxyBatchSchema } from '../../types/outboxy-envelope';
import { ResultProcessorService } from '../result-processor/result-processor.service';

@Controller('webhooks')
@UseGuards(WebhookAuthGuard)
export class WebhookReceiverController {
  private readonly logger = new Logger(WebhookReceiverController.name);

  constructor(
    private readonly resultProcessor: ResultProcessorService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  @Post('outboxy')
  @HttpCode(HttpStatus.OK)
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

    const failedEventIds: string[] = [];

    for (const event of sortedEvents) {
      this.logger.log(`Processing event: ${event.eventType}`);
      try {
        await this.resultProcessor.processEvent(event);
      } catch (error) {
        failedEventIds.push(event.eventId);
        this.logger.error(
          `Failed to process event ${event.eventId} (${event.eventType}): ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    if (failedEventIds.length > 0) {
      this.logger.error(
        `Batch had ${failedEventIds.length} failures: ${failedEventIds.join(', ')}`,
      );
      throw new InternalServerErrorException({
        message: `Failed to process ${failedEventIds.length} of ${sortedEvents.length} events`,
        code: 'PARTIAL_BATCH_FAILURE',
        failedEventIds,
      });
    }

    return { received: true, processed: events.length };
  }
}
