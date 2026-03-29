import { Test } from '@nestjs/testing';
import type { OrganizationId, ProjectId, RunId, SuiteId } from '@spechive/shared-types';
import { describe, it, expect, beforeEach } from 'vitest';

import { createMockPinoLogger } from '../../../../test/unit-helpers/mock-logger';
import type { EventHandlerContext } from '../../src/modules/result-processor/handlers/event-handler.interface';
import { SuiteEndHandler } from '../../src/modules/result-processor/handlers/suite-end.handler';

describe('SuiteEndHandler', () => {
  let handler: SuiteEndHandler;
  let ctx: EventHandlerContext;

  beforeEach(async () => {
    ctx = {
      tx: {} as EventHandlerContext['tx'],
      organizationId: 'org-1' as OrganizationId,
      projectId: 'proj-1' as ProjectId,
    };

    const module = await Test.createTestingModule({
      providers: [SuiteEndHandler, createMockPinoLogger('SuiteEndHandler')],
    }).compile();

    handler = module.get(SuiteEndHandler);
  });

  it('handles suite.end event without throwing', async () => {
    const event = {
      version: '1' as const,
      timestamp: '2025-01-01T00:00:00.000Z',
      runId: 'run-1' as RunId,
      eventType: 'suite.end' as const,
      payload: {
        suiteId: 'suite-1' as SuiteId,
      },
    };

    await expect(handler.handle(event, ctx)).resolves.not.toThrow();
  });
});
