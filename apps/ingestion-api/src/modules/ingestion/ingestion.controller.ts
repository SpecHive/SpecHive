import { V1EventSchema } from '@assertly/reporter-core-protocol';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { CurrentProject } from '../../decorators/current-project.decorator';
import { ProjectTokenGuard } from '../../guards/project-token.guard';
import type { ProjectContext } from '../../guards/project-token.guard';
import type { EnvConfig } from '../config/env.validation';

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { IngestionService } from './ingestion.service';

@Controller('v1')
export class IngestionController {
  private readonly isProduction: boolean;

  constructor(
    private readonly ingestionService: IngestionService,
    configService: ConfigService<EnvConfig>,
  ) {
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
  }

  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ProjectTokenGuard)
  async ingestEvent(@Body() body: unknown, @CurrentProject() project: ProjectContext) {
    const result = V1EventSchema.safeParse(body);

    if (!result.success) {
      const message = this.isProduction
        ? 'Invalid event payload'
        : `Invalid event payload: ${JSON.stringify(z.flattenError(result.error))}`;
      throw new BadRequestException({ message });
    }

    return this.ingestionService.processEvent(
      result.data,
      project.projectId,
      project.organizationId,
    );
  }
}
