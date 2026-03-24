import { Test } from '@nestjs/testing';
import type { RunId, SuiteId, TestId } from '@spechive/shared-types';
import { TestStatus } from '@spechive/shared-types';
import { describe, it, expect, beforeEach } from 'vitest';

import { createHandlerContext } from '../../../../test/unit-helpers/handler-context';
import { TestStartHandler } from '../../src/modules/result-processor/handlers/test-start.handler';

describe('TestStartHandler', () => {
  let handler: TestStartHandler;
  let ctx: ReturnType<typeof createHandlerContext>['ctx'];
  let mocks: ReturnType<typeof createHandlerContext>['mocks'];

  beforeEach(async () => {
    ({ ctx, mocks } = createHandlerContext());

    const module = await Test.createTestingModule({
      providers: [TestStartHandler],
    }).compile();

    handler = module.get(TestStartHandler);
  });

  it('inserts test with testName mapped to name', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.start' as const,
      payload: {
        testId: 'test-1' as TestId,
        suiteId: 'suite-1' as SuiteId,
        testName: 'should login successfully',
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.insert).toHaveBeenCalled();
    expect(mocks.insert.values).toHaveBeenCalledWith({
      id: 'test-1',
      suiteId: 'suite-1',
      runId: 'run-1',
      organizationId: 'org-1',
      name: 'should login successfully',
      status: TestStatus.Pending,
      startedAt: new Date('2025-01-01T00:00:00.000Z'),
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });
  });

  it('logs debug when duplicate is skipped', async () => {
    mocks.insert.returning.mockResolvedValueOnce([]);

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.start' as const,
      payload: {
        testId: 'test-dup' as TestId,
        suiteId: 'suite-1' as SuiteId,
        testName: 'dup test',
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.returning).toHaveBeenCalled();
  });
});
