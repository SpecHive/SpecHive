import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { IS_PRODUCTION, Public, throwZodBadRequest } from '@spechive/nestjs-common';
import type { ProjectContext } from '@spechive/nestjs-common';
import { V1EventSchema } from '@spechive/reporter-core-protocol';

import { CurrentProject } from '../../decorators/current-project.decorator';

import { IngestionService } from './ingestion.service';

@Controller('v1')
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  @Get('capabilities')
  @Public()
  capabilities() {
    return {
      supportedVersions: ['1'],
      currentVersion: '1',
      eventTypes: [
        'run.start',
        'run.end',
        'suite.start',
        'suite.end',
        'test.start',
        'test.end',
        'artifact.upload',
      ],
    };
  }

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestEvent(@Body() body: unknown, @CurrentProject() project: ProjectContext) {
    const result = V1EventSchema.safeParse(body);

    if (!result.success) {
      throwZodBadRequest(result.error, 'Invalid event payload', this.isProduction);
    }

    return this.ingestionService.processEvent(
      result.data,
      project.projectId,
      project.organizationId,
    );
  }
}
