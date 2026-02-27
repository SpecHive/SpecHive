import type { OrganizationId, ProjectId, RunId, SuiteId, TestId } from '@assertly/shared-types';
import { TestStatus } from '@assertly/shared-types';
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { EventHandlerContext } from '../../src/modules/result-processor/handlers/event-handler.interface';
import { TestStartHandler } from '../../src/modules/result-processor/handlers/test-start.handler';

describe('TestStartHandler', () => {
  let handler: TestStartHandler;
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

    expect(mockInsert).toHaveBeenCalled();
    const valuesCall = mockInsert.mock.results[0].value.values;
    expect(valuesCall).toHaveBeenCalledWith({
      id: 'test-1',
      suiteId: 'suite-1',
      runId: 'run-1',
      organizationId: 'org-1',
      name: 'should login successfully',
      status: TestStatus.Pending,
      startedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
  });
});
