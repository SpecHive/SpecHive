import { Test } from '@nestjs/testing';
import type { RunId } from '@spechive/shared-types';
import { RunStatus } from '@spechive/shared-types';
import { describe, it, expect, beforeEach } from 'vitest';

import { createHandlerContext } from '../../../../test/unit-helpers/handler-context';
import { RunEndHandler } from '../../src/modules/result-processor/handlers/run-end.handler';

describe('RunEndHandler', () => {
  let handler: RunEndHandler;
  let ctx: ReturnType<typeof createHandlerContext>['ctx'];
  let mocks: ReturnType<typeof createHandlerContext>['mocks'];

  beforeEach(async () => {
    ({ ctx, mocks } = createHandlerContext());

    // Conditional UPDATE returns the updated row (simulates successful transition)
    mocks.update.returning.mockResolvedValue([{ id: 'run-1' }]);

    const module = await Test.createTestingModule({
      providers: [RunEndHandler],
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
});
