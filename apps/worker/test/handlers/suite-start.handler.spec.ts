import type { OrganizationId, ProjectId, RunId, SuiteId } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { EventHandlerContext } from '../../src/modules/result-processor/handlers/event-handler.interface';
import { SuiteStartHandler } from '../../src/modules/result-processor/handlers/suite-start.handler';

describe('SuiteStartHandler', () => {
  let handler: SuiteStartHandler;
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

    expect(mockInsert).toHaveBeenCalled();
    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith({
      id: 'suite-1',
      runId: 'run-1',
      organizationId: 'org-1',
      name: 'Auth Tests',
      parentSuiteId: null,
    });
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

    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith(expect.objectContaining({ parentSuiteId: 'suite-1' }));
  });
});
