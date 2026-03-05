import { ZodValidationPipe } from '@assertly/nestjs-common';
import type { ArtifactId } from '@assertly/shared-types';
import { Controller, Get, Param } from '@nestjs/common';

import { uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

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
