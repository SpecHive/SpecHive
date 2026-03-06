import type { RunId } from '@assertly/shared-types';
import { RunStatus } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { createHandlerContext } from '../../../../test/unit-helpers/handler-context';
import { RunEndHandler } from '../../src/modules/result-processor/handlers/run-end.handler';

describe('RunEndHandler', () => {
  let handler: RunEndHandler;
  let ctx: ReturnType<typeof createHandlerContext>['ctx'];
  let mocks: ReturnType<typeof createHandlerContext>['mocks'];

  beforeEach(async () => {
    ({ ctx, mocks } = createHandlerContext());

    // run-end reads the current run status before updating
    mocks.select.where.mockResolvedValue([{ status: RunStatus.Running }]);

    const module = await Test.createTestingModule({
      providers: [RunEndHandler],
    }).compile();

    handler = module.get(RunEndHandler);
  });

  it('updates run status and finishedAt', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T01:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'run.end' as const,
      payload: { status: RunStatus.Passed },
    };

    await handler.handle(event, ctx);

    expect(mocks.select.select).toHaveBeenCalled();
    expect(mocks.update.update).toHaveBeenCalled();
    expect(mocks.update.set).toHaveBeenCalledWith({
      status: RunStatus.Passed,
      finishedAt: new Date('2025-01-01T01:00:00.000Z'),
    });
    expect(mocks.update.where).toHaveBeenCalled();
  });
});
