import { V1EventSchema } from '@assertly/reporter-core-protocol';
import { Body, Controller, HttpCode, HttpStatus, Post, BadRequestException } from '@nestjs/common';

import type { IngestionService } from './ingestion.service';

@Controller('v1')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestEvent(@Body() body: unknown) {
    const result = V1EventSchema.safeParse(body);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Invalid event payload',
        errors: result.error.flatten(),
      });
    }

    return this.ingestionService.processEvent(result.data);
  }
}
