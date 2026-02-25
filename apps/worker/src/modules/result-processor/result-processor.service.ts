import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ResultProcessorService {
  private readonly logger = new Logger(ResultProcessorService.name);

  // Full processing logic deferred to Sprint 1
  processEvent(payload: unknown): void {
    this.logger.log(`Received outbox event: ${JSON.stringify(payload)}`);
  }
}
