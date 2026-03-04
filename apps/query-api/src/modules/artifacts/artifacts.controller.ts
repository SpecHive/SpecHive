import { IS_PRODUCTION, throwZodBadRequest } from '@assertly/nestjs-common';
import type { ArtifactId } from '@assertly/shared-types';
import { Controller, Get, Inject, Param } from '@nestjs/common';

import { uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { ArtifactsService } from './artifacts.service';

@Controller('v1/artifacts')
export class ArtifactsController {
  constructor(
    private readonly artifactsService: ArtifactsService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  @Get(':id/download')
  async download(@CurrentUser() user: UserContext, @Param('id') id: string) {
    const result = uuidSchema.safeParse(id);
    if (!result.success) throwZodBadRequest(result.error, 'Invalid artifact ID', this.isProduction);

    return this.artifactsService.getDownloadUrl(user.organizationId, result.data as ArtifactId);
  }
}
