import { Controller, Get, Param } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import type { ArtifactId } from '@spechive/shared-types';

import { uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';

import { ArtifactsService } from './artifacts.service';

@Controller('v1/artifacts')
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  @Get(':id/download')
  async download(
    @CurrentUser() user: UserContext,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
  ) {
    return this.artifactsService.getDownloadUrl(user.organizationId, id as ArtifactId);
  }
}
