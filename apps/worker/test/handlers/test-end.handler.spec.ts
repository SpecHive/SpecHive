import { Test } from '@nestjs/testing';
import type { OrganizationId, ProjectId, RunId, TestId } from '@spechive/shared-types';
import { TestStatus } from '@spechive/shared-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { EventHandlerContext } from '../../src/modules/result-processor/handlers/event-handler.interface';
import { TestEndHandler } from '../../src/modules/result-processor/handlers/test-end.handler';

describe('TestEndHandler', () => {
  let handler: TestEndHandler;
  let testUpdateWhere: ReturnType<typeof vi.fn>;
  let testUpdateSet: ReturnType<typeof vi.fn>;
  let runUpdateWhere: ReturnType<typeof vi.fn>;
  let runUpdateSet: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let ctx: EventHandlerContext;

  beforeEach(async () => {
    let updateCallCount = 0;
    testUpdateWhere = vi.fn();
    testUpdateSet = vi.fn().mockReturnValue({ where: testUpdateWhere });
    runUpdateWhere = vi.fn();
    runUpdateSet = vi.fn().mockReturnValue({ where: runUpdateWhere });

    mockUpdate = vi.fn().mockImplementation(() => {
      updateCallCount++;
      // First update call is for tests table, second for runs table
      return { set: updateCallCount === 1 ? testUpdateSet : runUpdateSet };
    });

    ctx = {
      tx: { update: mockUpdate } as unknown as EventHandlerContext['tx'],
      organizationId: 'org-1' as OrganizationId,
      projectId: 'proj-1' as ProjectId,
    };

    const module = await Test.createTestingModule({
      providers: [TestEndHandler],
    }).compile();

    handler = module.get(TestEndHandler);
  });

  it('updates test status and increments run counters', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Passed,
        durationMs: 150,
      },
    };

    await handler.handle(event, ctx);

    // First call updates tests table
    expect(testUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TestStatus.Passed,
        durationMs: 150,
        finishedAt: new Date('2025-01-01T00:01:00.000Z'),
      }),
    );

    // Second call updates runs table counters
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(runUpdateSet).toHaveBeenCalled();
  });

  it('strips ANSI escape codes from errorMessage and stackTrace', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Failed,
        durationMs: 100,
        errorMessage:
          '\x1b[2mexpect(\x1b[22m\x1b[31mreceived\x1b[39m\x1b[2m).toBeVisible()\x1b[22m',
        stackTrace:
          '\x1b[31mError\x1b[39m: test failed\n    at Object.<anonymous> (\x1b[2mtest.ts:10:5\x1b[22m)',
      },
    };

    await handler.handle(event, ctx);

    expect(testUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: 'expect(received).toBeVisible()',
        stackTrace: 'Error: test failed\n    at Object.<anonymous> (test.ts:10:5)',
      }),
    );
  });

  it('sets null for optional fields when not provided', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Failed,
      },
    };

    await handler.handle(event, ctx);

    expect(testUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: null,
        errorMessage: null,
        stackTrace: null,
        retryCount: 0,
      }),
    );
  });
});
