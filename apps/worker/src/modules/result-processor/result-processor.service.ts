import { Injectable, Logger } from '@nestjs/common';

import type { OutboxyEnvelope } from '../webhook-receiver/webhook-receiver.controller';

@Injectable()
export class ResultProcessorService {
  private readonly logger = new Logger(ResultProcessorService.name);

  async processEvent(payload: OutboxyEnvelope): Promise<void> {
    this.logger.log(
      `Processing event: ${payload.eventType} for ${payload.aggregateType}:${payload.aggregateId}`,
    );
  }
}
