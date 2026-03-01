import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import type { ArtifactId } from '@assertly/shared-types';
import { Controller, Get, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { ArtifactsService } from './artifacts.service';

@Controller('v1/artifacts')
export class ArtifactsController {
  private readonly isProduction: boolean;

  constructor(
    private readonly artifactsService: ArtifactsService,
    configService: ConfigService,
  ) {
    this.isProduction = isProductionEnv(configService);
  }

  @Get(':id/download')
  async download(@CurrentUser() user: UserContext, @Param('id') id: string) {
    const result = uuidSchema.safeParse(id);
    if (!result.success) throwZodBadRequest(result.error, 'Invalid artifact ID', this.isProduction);

    return this.artifactsService.getDownloadUrl(user.organizationId, result.data as ArtifactId);
  }
}
