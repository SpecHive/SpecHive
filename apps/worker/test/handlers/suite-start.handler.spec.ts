import type { RunId, SuiteId } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { createHandlerContext } from '../../../../test/unit-helpers/handler-context';
import { SuiteStartHandler } from '../../src/modules/result-processor/handlers/suite-start.handler';

describe('SuiteStartHandler', () => {
  let handler: SuiteStartHandler;
  let ctx: ReturnType<typeof createHandlerContext>['ctx'];
  let mocks: ReturnType<typeof createHandlerContext>['mocks'];

  beforeEach(async () => {
    ({ ctx, mocks } = createHandlerContext());

    const module = await Test.createTestingModule({
      providers: [SuiteStartHandler],
    }).compile();

    handler = module.get(SuiteStartHandler);
  });

  it('inserts suite with suiteName mapped to name', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'suite.start' as const,
      payload: {
        suiteId: 'suite-1' as SuiteId,
        suiteName: 'Auth Tests',
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.insert).toHaveBeenCalled();
    expect(mocks.insert.values).toHaveBeenCalledWith({
      id: 'suite-1',
      runId: 'run-1',
      organizationId: 'org-1',
      name: 'Auth Tests',
      parentSuiteId: null,
    });
    expect(mocks.insert.onConflictDoNothing).toHaveBeenCalledWith();
  });

  it('passes parentSuiteId when provided', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'suite.start' as const,
      payload: {
        suiteId: 'suite-2' as SuiteId,
        suiteName: 'Login Tests',
        parentSuiteId: 'suite-1' as SuiteId,
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.values).toHaveBeenCalledWith(
      expect.objectContaining({ parentSuiteId: 'suite-1' }),
    );
  });

  it('handles duplicate suite gracefully (no target constraint)', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'suite.start' as const,
      payload: {
        suiteId: 'suite-1' as SuiteId,
        suiteName: 'Auth Tests',
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.onConflictDoNothing).toHaveBeenCalledWith();
    expect(mocks.insert.onConflictDoNothing).not.toHaveBeenCalledWith(
      expect.objectContaining({ target: expect.anything() }),
    );
  });

  it('logs debug when duplicate is skipped', async () => {
    mocks.insert.returning.mockResolvedValueOnce([]);

    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'suite.start' as const,
      payload: {
        suiteId: 'suite-dup' as SuiteId,
        suiteName: 'Dup Suite',
      },
    };

    await handler.handle(event, ctx);

    expect(mocks.insert.returning).toHaveBeenCalled();
  });
});
