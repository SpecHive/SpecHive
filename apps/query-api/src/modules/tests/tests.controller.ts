import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import { TestStatus } from '@spechive/shared-types';
import type { RunId, SuiteId, TestId } from '@spechive/shared-types';
import { z } from 'zod';

import { paginationSchema, uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';

import { TestsService } from './tests.service';

const listTestsSchema = paginationSchema.extend({
  status: z.nativeEnum(TestStatus).optional(),
  suiteId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'status', 'durationMs', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

@Controller('v1/runs/:runId/tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Get()
  async list(
    @CurrentUser() user: UserContext,
    @Param('runId', new ZodValidationPipe(uuidSchema)) runId: string,
    @Query(new ZodValidationPipe(listTestsSchema)) query: z.infer<typeof listTestsSchema>,
  ) {
    return this.testsService.listTests(
      user.organizationId,
      runId as RunId,
      { page: query.page, pageSize: query.pageSize },
      query.status,
      query.suiteId as SuiteId | undefined,
      query.sortBy,
      query.sortOrder,
    );
  }

  @Get(':testId')
  async getById(
    @CurrentUser() user: UserContext,
    @Param('runId', new ZodValidationPipe(uuidSchema)) runId: string,
    @Param('testId', new ZodValidationPipe(uuidSchema)) testId: string,
  ) {
    return this.testsService.getTestById(user.organizationId, runId as RunId, testId as TestId);
  }
}
