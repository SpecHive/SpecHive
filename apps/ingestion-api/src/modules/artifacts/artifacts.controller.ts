import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { ProjectContext } from '@spechive/nestjs-common';

import { CurrentProject } from '../../decorators/current-project.decorator';

import { ArtifactsService } from './artifacts.service';
import { PresignRequestSchema } from './presign-request.schema';
import type { PresignRequest } from './presign-request.schema';

@Controller('v1/artifacts')
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Post('presign')
  @HttpCode(HttpStatus.CREATED)
  async presign(
    @Body(new ZodValidationPipe(PresignRequestSchema)) body: PresignRequest,
    @CurrentProject() project: ProjectContext,
  ) {
    return this.artifactsService.createPresignedUpload(
      body,
      project.projectId,
      project.organizationId,
    );
  }
}
