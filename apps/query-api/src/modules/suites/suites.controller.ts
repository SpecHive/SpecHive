import { IS_PRODUCTION, throwZodBadRequest } from '@assertly/nestjs-common';
import type { RunId } from '@assertly/shared-types';
import { Controller, Get, Inject, Param } from '@nestjs/common';

import { uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { SuitesService } from './suites.service';

@Controller('v1/runs')
export class SuitesController {
  constructor(
    private readonly suitesService: SuitesService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

  @Get(':runId/suites')
  async listByRunId(@CurrentUser() user: UserContext, @Param('runId') runId: string) {
    const result = uuidSchema.safeParse(runId);
    if (!result.success) throwZodBadRequest(result.error, 'Invalid request', this.isProduction);

    return this.suitesService.listSuitesByRunId(user.organizationId, result.data as RunId);
  }
}
