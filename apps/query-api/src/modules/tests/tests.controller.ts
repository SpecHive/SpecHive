import { isProductionEnv, throwZodBadRequest } from '@assertly/nestjs-common';
import type { RunId, SuiteId, TestId } from '@assertly/shared-types';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

import { paginationSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { TestsService } from './tests.service';

const listTestsSchema = paginationSchema.extend({
  status: z.string().optional(),
  suiteId: z.string().uuid().optional(),
});

const uuidSchema = z.string().uuid();

@Controller('v1/runs/:runId/tests')
export class TestsController {
  private readonly isProduction: boolean;

  constructor(
    private readonly testsService: TestsService,
    configService: ConfigService,
  ) {
    this.isProduction = isProductionEnv(configService);
  }

  @Get()
  async list(
    @CurrentUser() user: UserContext,
    @Param('runId') runId: string,
    @Query() query: Record<string, string>,
  ) {
    const runIdResult = uuidSchema.safeParse(runId);
    if (!runIdResult.success)
      throwZodBadRequest(runIdResult.error, 'Invalid run ID', this.isProduction);

    const result = listTestsSchema.safeParse(query);
    if (!result.success) throwZodBadRequest(result.error, 'Invalid request', this.isProduction);

    return this.testsService.listTests(
      user.organizationId,
      runIdResult.data as RunId,
      { page: result.data.page, pageSize: result.data.pageSize },
      result.data.status,
      result.data.suiteId as SuiteId | undefined,
    );
  }

  @Get(':testId')
  async getById(
    @CurrentUser() user: UserContext,
    @Param('runId') runId: string,
    @Param('testId') testId: string,
  ) {
    const runIdResult = uuidSchema.safeParse(runId);
    if (!runIdResult.success)
      throwZodBadRequest(runIdResult.error, 'Invalid run ID', this.isProduction);

    const testIdResult = uuidSchema.safeParse(testId);
    if (!testIdResult.success)
      throwZodBadRequest(testIdResult.error, 'Invalid test ID', this.isProduction);

    return this.testsService.getTestById(
      user.organizationId,
      runIdResult.data as RunId,
      testIdResult.data as TestId,
    );
  }
}
