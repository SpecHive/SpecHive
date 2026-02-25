import { Injectable, Logger } from '@nestjs/common';

import type { OutboxyEnvelope } from '../../types/outboxy-envelope';

@Injectable()
export class ResultProcessorService {
  private readonly logger = new Logger(ResultProcessorService.name);

  // Event processing deferred to Sprint 1 — envelope acknowledged, no further action
  async processEvent(payload: OutboxyEnvelope): Promise<void> {
    this.logger.log(
      `Processing event: ${payload.eventType} for ${payload.aggregateType}:${payload.aggregateId}`,
    );
  }
}
