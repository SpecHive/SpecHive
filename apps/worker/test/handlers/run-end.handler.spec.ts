import type { OrganizationId, ProjectId, RunId } from '@assertly/shared-types';
import { RunStatus } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { EventHandlerContext } from '../../src/modules/result-processor/handlers/event-handler.interface';
import { RunEndHandler } from '../../src/modules/result-processor/handlers/run-end.handler';

describe('RunEndHandler', () => {
  let handler: RunEndHandler;
  let mockWhere: ReturnType<typeof vi.fn>;
  let mockSet: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let ctx: EventHandlerContext;

  beforeEach(async () => {
    mockWhere = vi.fn();
    mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    ctx = {
      tx: { update: mockUpdate } as unknown as EventHandlerContext['tx'],
      organizationId: 'org-1' as OrganizationId,
      projectId: 'proj-1' as ProjectId,
    };

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

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({
      status: RunStatus.Passed,
      finishedAt: new Date('2025-01-01T01:00:00.000Z'),
    });
    expect(mockWhere).toHaveBeenCalled();
  });
});
