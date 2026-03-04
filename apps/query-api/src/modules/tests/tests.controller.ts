import { IS_PRODUCTION, throwZodBadRequest } from '@assertly/nestjs-common';
import { TestStatus } from '@assertly/shared-types';
import type { RunId, SuiteId, TestId } from '@assertly/shared-types';
import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { z } from 'zod';

import { paginationSchema, uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { UserContext } from '../auth/types';

import { TestsService } from './tests.service';

const listTestsSchema = paginationSchema.extend({
  status: z.nativeEnum(TestStatus).optional(),
  suiteId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'status', 'durationMs', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

@Controller('v1/runs/:runId/tests')
export class TestsController {
  constructor(
    private readonly testsService: TestsService,
    @Inject(IS_PRODUCTION) private readonly isProduction: boolean,
  ) {}

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
      result.data.sortBy,
      result.data.sortOrder,
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
