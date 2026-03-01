import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import type { RunId } from '@assertly/shared-types';
import { Controller, Get, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { SuitesService } from './suites.service';

@Controller('v1/runs')
export class SuitesController {
  private readonly isProduction: boolean;

  constructor(
    private readonly suitesService: SuitesService,
    configService: ConfigService,
  ) {
    this.isProduction = isProductionEnv(configService);
  }

  @Get(':runId/suites')
  async listByRunId(@CurrentUser() user: UserContext, @Param('runId') runId: string) {
    const result = uuidSchema.safeParse(runId);
    if (!result.success) throwZodBadRequest(result.error, 'Invalid request', this.isProduction);

    return this.suitesService.listSuitesByRunId(user.organizationId, result.data as RunId);
  }
}
