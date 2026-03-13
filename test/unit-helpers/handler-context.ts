import type { OrganizationId, ProjectId } from '@spechive/shared-types';

import type { EventHandlerContext } from '../../apps/worker/src/modules/result-processor/handlers/event-handler.interface';

import type { MockInsertChain, MockSelectChain, MockUpdateChain } from './drizzle-mock';
import {
  createMockInsertChain,
  createMockSelectChain,
  createMockUpdateChain,
} from './drizzle-mock';

export interface HandlerContextResult {
  ctx: EventHandlerContext;
  mocks: {
    insert: MockInsertChain;
    select: MockSelectChain;
    update: MockUpdateChain;
  };
}

/**
 * Create a fully-mocked EventHandlerContext with chainable tx mocks.
 * Returns `{ ctx, mocks }` where mocks exposes all vi.fn() references for assertions.
 */
export function createHandlerContext(overrides?: {
  organizationId?: string;
  projectId?: string;
}): HandlerContextResult {
  const insertChain = createMockInsertChain();
  const selectChain = createMockSelectChain();
  const updateChain = createMockUpdateChain();

  const ctx: EventHandlerContext = {
    tx: {
      insert: insertChain.insert,
      select: selectChain.select,
      update: updateChain.update,
    } as unknown as EventHandlerContext['tx'],
    organizationId: (overrides?.organizationId ?? 'org-1') as OrganizationId,
    projectId: (overrides?.projectId ?? 'proj-1') as ProjectId,
  };

  return {
    ctx,
    mocks: {
      insert: insertChain,
      select: selectChain,
      update: updateChain,
    },
  };
}
