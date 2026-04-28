import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IS_PRODUCTION,
  METRICS_SERVICE,
  MetricsService,
  RetryableError,
  throwZodBadRequest,
} from '@spechive/nestjs-common';
import { InjectPinoLogger, PinoLogger } from '@spechive/nestjs-common';

import { WebhookAuthGuard } from '../../guards/webhook-auth.guard';
import { OutboxyBatchSchema } from '../../types/outboxy-envelope';
import { ResultProcessorService } from '../result-processor/result-processor.service';

@Controller('webhooks')
@UseGuards(WebhookAuthGuard)
export class WebhookReceiverController {
  private readonly eventsProcessed: ReturnType<MetricsService['createCounter']>;

  constructor(
    @InjectPinoLogger(WebhookReceiverController.name) private readonly logger: PinoLogger,
    private readonly resultProcessor: ResultProcessorService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
    @Inject(METRICS_SERVICE) metrics: MetricsService,
  ) {
    this.eventsProcessed = metrics.createCounter(
      'spechive_worker_events_processed_total',
      'Total worker events processed',
      ['event_type', 'status'],
    );
  }

  @Post('outboxy')
  @HttpCode(HttpStatus.OK)
  async receiveOutboxyEvent(@Body() body: unknown) {
    const result = OutboxyBatchSchema.safeParse(body);

    if (!result.success) {
      this.logger.warn('Invalid webhook payload received');
      this.logger.debug({ validationErrors: result.error.flatten() }, 'Webhook validation details');
      throwZodBadRequest(result.error, 'Invalid webhook payload', this.isProduction);
    }

    const { events } = result.data;

    const sortedEvents = this.resultProcessor.sortEventsByPriority(events);

    this.logger.info({ eventCount: sortedEvents.length }, 'Received Outboxy batch');

    const failedEventIds: string[] = [];
    let retryableCount = 0;

    for (const event of sortedEvents) {
      this.logger.info({ eventType: event.eventType }, 'Processing event');
      try {
        const outcome = await this.resultProcessor.processEvent(event);
        // Outcome → label mapping:
        //   'processed' → 'success'   (normal handler execution)
        //   'duplicate' → 'duplicate' (inbox dedup — redelivered by Outboxy retry)
        //   'invalid'   → 'invalid'   (envelope failed EnrichedEventEnvelopeSchema parse)
        // Recording rules (worker_failure_ratio, worker_retryable_ratio) exclude
        // 'duplicate' from the denominator so redelivery storms don't skew ratios.
        const status =
          outcome === 'processed' ? 'success' : outcome === 'duplicate' ? 'duplicate' : 'invalid';
        this.eventsProcessed.inc({ event_type: event.eventType, status });
      } catch (error) {
        failedEventIds.push(event.eventId);

        if (error instanceof RetryableError) {
          retryableCount++;
          this.eventsProcessed.inc({ event_type: event.eventType, status: 'retryable' });
          this.logger.warn(
            { err: error, eventId: event.eventId, eventType: event.eventType },
            'Retryable event processing failure',
          );
        } else {
          this.eventsProcessed.inc({ event_type: event.eventType, status: 'failed' });
          this.logger.error(
            { err: error, eventId: event.eventId, eventType: event.eventType },
            'Failed to process event',
          );
        }
      }
    }

    if (failedEventIds.length > 0) {
      const batchContext = { failedCount: failedEventIds.length, retryableCount, failedEventIds };
      if (retryableCount === failedEventIds.length) {
        this.logger.warn(batchContext, 'Batch failures (all retryable)');
      } else {
        this.logger.error(batchContext, 'Batch failures');
      }
      throw new InternalServerErrorException({
        message: `Failed to process ${failedEventIds.length} of ${sortedEvents.length} events`,
        code: 'PARTIAL_BATCH_FAILURE',
        failedEventIds,
        retryableCount,
      });
    }

    return { received: true, processed: sortedEvents.length };
  }
}
