import { Test } from '@nestjs/testing';
import type { RunId, TestId } from '@spechive/shared-types';
import { TestStatus } from '@spechive/shared-types';
import { describe, it, expect, beforeEach } from 'vitest';

import { createHandlerContext } from '../../../../test/unit-helpers/handler-context';
import { createMockPinoLogger } from '../../../../test/unit-helpers/mock-logger';
import { TestEndHandler } from '../../src/modules/result-processor/handlers/test-end.handler';

describe('TestEndHandler', () => {
  let handler: TestEndHandler;
  let ctx: ReturnType<typeof createHandlerContext>['ctx'];
  let mocks: ReturnType<typeof createHandlerContext>['mocks'];

  beforeEach(async () => {
    ({ ctx, mocks } = createHandlerContext());

    mocks.update.returning.mockResolvedValue([{ name: 'should login' }]);

    const module = await Test.createTestingModule({
      providers: [TestEndHandler, createMockPinoLogger('TestEndHandler')],
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

    expect(mocks.update.update).toHaveBeenCalledTimes(2);
    expect(mocks.update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TestStatus.Passed,
        durationMs: 150,
        finishedAt: new Date('2025-01-01T00:01:00.000Z'),
      }),
    );
  });

  it('returns test name via returning clause', async () => {
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

    expect(mocks.update.returning).toHaveBeenCalledWith(
      expect.objectContaining({ name: expect.anything() }),
    );
  });

  it('UPSERTs daily_flaky_test_stats for flaky test', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Flaky,
        durationMs: 200,
        retryCount: 3,
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('UPSERTs daily_flaky_test_stats for non-flaky test', async () => {
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

    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it('skips UPSERT when test update returns no rows', async () => {
    mocks.update.returning.mockResolvedValue([]);

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Flaky,
        durationMs: 200,
        retryCount: 2,
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('strips ANSI escape codes from errorMessage and stackTrace', async () => {
    // Error block fires (status=Failed + errorMessage): configure mocks
    mocks.select.limit.mockResolvedValueOnce([{ branch: 'main', commitSha: 'abc123' }]);
    mocks.insert.returning.mockResolvedValueOnce([{ id: 'eg-1' }]);

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

    expect(mocks.update.set).toHaveBeenCalledWith(
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

    expect(mocks.update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: null,
        errorMessage: null,
        stackTrace: null,
        retryCount: 0,
      }),
    );
  });

  it('upserts error group and inserts occurrence for failed test', async () => {
    mocks.select.limit.mockResolvedValueOnce([{ branch: 'main', commitSha: 'abc123' }]);
    mocks.insert.returning.mockResolvedValueOnce([{ id: 'eg-1' }]);

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Failed,
        durationMs: 100,
        errorMessage: 'Expected true to be false',
        errorName: 'AssertionError',
      },
    };

    await handler.handle(event, ctx);

    // 1 execute call: dailyFlakyTestStats (no per-test recount — RunEndHandler handles it)
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    // 3 update calls: tests status + tests.errorGroupId + runs counters
    expect(mocks.update.update).toHaveBeenCalledTimes(3);
    // 2 insert calls: errorGroups upsert + errorOccurrences
    expect(mocks.insert.insert).toHaveBeenCalledTimes(2);
    expect(mocks.insert.onConflictDoUpdate).toHaveBeenCalledOnce();
    expect(mocks.insert.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('skips error processing when no errorMessage', async () => {
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

    // 1 execute call: dailyFlakyTestStats only (no error processing)
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    // 2 update calls: tests status + runs counters (no tests.errorGroupId)
    expect(mocks.update.update).toHaveBeenCalledTimes(2);
  });

  it('processes error for flaky test with errorMessage', async () => {
    mocks.select.limit.mockResolvedValueOnce([{ branch: 'feat/login', commitSha: 'def456' }]);
    mocks.insert.returning.mockResolvedValueOnce([{ id: 'eg-2' }]);

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Flaky,
        durationMs: 200,
        retryCount: 2,
        errorMessage: 'Timeout waiting for element',
      },
    };

    await handler.handle(event, ctx);

    // Error processing fires for flaky tests too
    // 1 execute call: dailyFlakyTestStats (no per-test recount)
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.update.update).toHaveBeenCalledTimes(3);
    // 2 insert calls: errorGroups upsert + errorOccurrences
    expect(mocks.insert.insert).toHaveBeenCalledTimes(2);
  });

  it('skips error processing for passed test', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Passed,
        durationMs: 50,
        errorMessage: 'stale error from a previous run',
      },
    };

    await handler.handle(event, ctx);

    // No error processing for passed tests regardless of errorMessage
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.update.update).toHaveBeenCalledTimes(2);
  });

  it('inserts test attempts and calls onConflictDoNothing when attempts are provided', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Flaky,
        durationMs: 200,
        retryCount: 1,
        attempts: [
          {
            retryIndex: 0,
            status: TestStatus.Failed,
            durationMs: 100,
            startedAt: '2025-01-01T00:00:00.000Z',
            finishedAt: '2025-01-01T00:00:01.000Z',
          },
          {
            retryIndex: 1,
            status: TestStatus.Passed,
            durationMs: 100,
            startedAt: '2025-01-01T00:00:01.000Z',
            finishedAt: '2025-01-01T00:00:02.000Z',
          },
        ],
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.insert).toHaveBeenCalledOnce();
    expect(mocks.insert.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ retryIndex: 0, status: TestStatus.Failed }),
        expect.objectContaining({ retryIndex: 1, status: TestStatus.Passed }),
      ]),
    );
    expect(mocks.insert.onConflictDoNothing).toHaveBeenCalled();
  });

  it('inserts both test attempts and error occurrences when combined', async () => {
    mocks.select.limit.mockResolvedValueOnce([{ branch: 'main', commitSha: 'abc123' }]);
    mocks.insert.returning.mockResolvedValueOnce([{ id: 'eg-1' }]);

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:01:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'test.end' as const,
      payload: {
        testId: 'test-1' as TestId,
        status: TestStatus.Failed,
        durationMs: 200,
        retryCount: 1,
        errorMessage: 'Expected true to be false',
        errorName: 'AssertionError',
        attempts: [
          {
            retryIndex: 0,
            status: TestStatus.Failed,
            durationMs: 100,
            startedAt: '2025-01-01T00:00:00.000Z',
            finishedAt: '2025-01-01T00:00:01.000Z',
            errorMessage: 'Expected true to be false',
          },
          {
            retryIndex: 1,
            status: TestStatus.Failed,
            durationMs: 100,
            startedAt: '2025-01-01T00:00:01.000Z',
            finishedAt: '2025-01-01T00:00:02.000Z',
            errorMessage: 'Expected true to be false',
          },
        ],
      },
    };

    await handler.handle(event, ctx);

    // 3 insert calls: testAttempts + errorGroups upsert + errorOccurrences
    expect(mocks.insert.insert).toHaveBeenCalledTimes(3);
    // testAttempts + errorOccurrences use onConflictDoNothing
    expect(mocks.insert.onConflictDoNothing).toHaveBeenCalledTimes(2);
    // errorGroups uses onConflictDoUpdate
    expect(mocks.insert.onConflictDoUpdate).toHaveBeenCalledOnce();
    // 1 execute call: dailyFlakyTestStats (no per-test recount)
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    // 3 update calls: tests status + tests.errorGroupId + runs counters
    expect(mocks.update.update).toHaveBeenCalledTimes(3);
  });
});
