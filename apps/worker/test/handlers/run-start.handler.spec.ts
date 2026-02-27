import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { RunStatus } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { EventHandlerContext } from '../../src/modules/result-processor/handlers/event-handler.interface';
import { RunStartHandler } from '../../src/modules/result-processor/handlers/run-start.handler';

describe('RunStartHandler', () => {
  let handler: RunStartHandler;
  let mockInsert: ReturnType<typeof vi.fn>;
  let ctx: EventHandlerContext;

  beforeEach(async () => {
    mockInsert = vi.fn().mockReturnValue({ values: vi.fn() });
    ctx = {
      tx: { insert: mockInsert } as unknown as EventHandlerContext['tx'],
      organizationId: 'org-1' as OrganizationId,
      projectId: 'proj-1' as ProjectId,
    };

    const module = await Test.createTestingModule({
      providers: [RunStartHandler],
    }).compile();

    handler = module.get(RunStartHandler);
  });

  it('inserts a run with correct fields', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'run.start' as const,
      payload: { metadata: { ci: true } },
    };

    await handler.handle(event, ctx);

    expect(mockInsert).toHaveBeenCalled();
    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith({
      id: 'run-1',
      projectId: 'proj-1',
      organizationId: 'org-1',
      status: RunStatus.Pending,
      startedAt: new Date('2025-01-01T00:00:00.000Z'),
      metadata: { ci: true },
    });
  });

  it('defaults metadata to empty object when not provided', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-2' as RunId,
      eventType: 'run.start' as const,
      payload: {},
    };

    await handler.handle(event, ctx);

    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
  });
});
