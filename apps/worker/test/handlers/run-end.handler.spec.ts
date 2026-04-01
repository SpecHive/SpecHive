import { Test } from '@nestjs/testing';
import type { RunId } from '@spechive/shared-types';
import { RunStatus } from '@spechive/shared-types';
import { describe, it, expect, beforeEach } from 'vitest';

import { createHandlerContext } from '../../../../test/unit-helpers/handler-context';
import { createMockPinoLogger } from '../../../../test/unit-helpers/mock-logger';
import { RunEndHandler } from '../../src/modules/result-processor/handlers/run-end.handler';

describe('RunEndHandler', () => {
  let handler: RunEndHandler;
  let ctx: ReturnType<typeof createHandlerContext>['ctx'];
  let mocks: ReturnType<typeof createHandlerContext>['mocks'];

  beforeEach(async () => {
    ({ ctx, mocks } = createHandlerContext());

    mocks.update.returning.mockResolvedValue([
      {
        id: 'run-1',
        totalTests: 10,
        passedTests: 8,
        failedTests: 1,
        skippedTests: 0,
        flakyTests: 1,
        startedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    ]);

    // Execute calls: retried tests COUNT, daily_run_stats UPSERT
    mocks.execute.mockResolvedValueOnce([{ retriedTests: 2 }]).mockResolvedValueOnce([]);

    const module = await Test.createTestingModule({
      providers: [RunEndHandler, createMockPinoLogger('RunEndHandler')],
    }).compile();

    handler = module.get(RunEndHandler);
  });

  it('updates run status and finishedAt via conditional UPDATE', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T01:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'run.end' as const,
      payload: { status: RunStatus.Passed },
    };

    await handler.handle(event, ctx);

    expect(mocks.update.update).toHaveBeenCalled();
    expect(mocks.update.set).toHaveBeenCalledWith({
      status: RunStatus.Passed,
      finishedAt: new Date('2025-01-01T01:00:00.000Z'),
    });
    expect(mocks.update.where).toHaveBeenCalled();
  });

  it('returns counter fields and startedAt in returning clause', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T01:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'run.end' as const,
      payload: { status: RunStatus.Passed },
    };

    await handler.handle(event, ctx);

    expect(mocks.update.returning).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.anything(),
        totalTests: expect.anything(),
        passedTests: expect.anything(),
        failedTests: expect.anything(),
        skippedTests: expect.anything(),
        flakyTests: expect.anything(),
        startedAt: expect.anything(),
      }),
    );
  });

  it('executes retried tests COUNT and daily_run_stats UPSERT', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T01:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'run.end' as const,
      payload: { status: RunStatus.Passed },
    };

    await handler.handle(event, ctx);

    // Two execute calls: retried count + daily_run_stats
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });

  it('does not UPSERT when run is already in terminal state', async () => {
    mocks.update.returning.mockResolvedValue([]);

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T01:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'run.end' as const,
      payload: { status: RunStatus.Passed },
    };

    await handler.handle(event, ctx);

    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('excludes duration from aggregates when startedAt is null', async () => {
    mocks.update.returning.mockResolvedValue([
      {
        id: 'run-1',
        totalTests: 5,
        passedTests: 5,
        failedTests: 0,
        skippedTests: 0,
        flakyTests: 0,
        startedAt: null,
      },
    ]);
    mocks.execute.mockResolvedValueOnce([{ retriedTests: 0 }]).mockResolvedValueOnce([]);

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T01:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'run.end' as const,
      payload: { status: RunStatus.Passed },
    };

    await handler.handle(event, ctx);

    // Two execute calls: retried count + daily_run_stats
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
});
