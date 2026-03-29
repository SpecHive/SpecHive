import { Controller, Get, Param } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import type { RunId } from '@spechive/shared-types';

import { uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';

import { ErrorsService } from './errors.service';

@Controller('v1/runs')
export class RunErrorsController {
  constructor(private readonly errorsService: ErrorsService) {}

  @Get(':runId/errors/summary')
  async getRunErrorsSummary(
    @CurrentUser() user: UserContext,
    @Param('runId', new ZodValidationPipe(uuidSchema)) runId: string,
  ) {
    return this.errorsService.getRunErrorsSummary(user.organizationId, runId as RunId);
  }
}
