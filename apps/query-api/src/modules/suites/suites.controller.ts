import { ZodValidationPipe } from '@assertly/nestjs-common';
import type { RunId } from '@assertly/shared-types';
import { Controller, Get, Param } from '@nestjs/common';

import { uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { SuitesService } from './suites.service';

@Controller('v1/runs')
export class SuitesController {
  constructor(private readonly suitesService: SuitesService) {}

  @Get(':runId/suites')
  async listByRunId(
    @CurrentUser() user: UserContext,
    @Param('runId', new ZodValidationPipe(uuidSchema)) runId: string,
  ) {
    return this.suitesService.listSuitesByRunId(user.organizationId, runId as RunId);
  }
}
