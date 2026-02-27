import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import { V1EventSchema } from '@assertly/reporter-core-protocol';
import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

import { CurrentProject } from '../../decorators/current-project.decorator';
import { ProjectTokenGuard } from '../../guards/project-token.guard';
import type { ProjectContext } from '../../guards/project-token.guard';
import type { EnvConfig } from '../config/env.validation';

import { IngestionService } from './ingestion.service';

const INGESTION_RATE_LIMIT_TTL_MS = 60_000;
const INGESTION_RATE_LIMIT_MAX = 300;

@Controller('v1')
@Throttle({ default: { ttl: INGESTION_RATE_LIMIT_TTL_MS, limit: INGESTION_RATE_LIMIT_MAX } })
export class IngestionController {
  private readonly isProduction: boolean;

  constructor(
    private readonly ingestionService: IngestionService,
    configService: ConfigService<EnvConfig>,
  ) {
    this.isProduction = isProductionEnv(configService);
  }

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ProjectTokenGuard)
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
