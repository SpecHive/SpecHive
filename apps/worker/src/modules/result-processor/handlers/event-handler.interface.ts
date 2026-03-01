import type { Transaction } from '@assertly/database';
import type { V1Event } from '@assertly/reporter-core-protocol';
import type { OrganizationId, ProjectId } from '@assertly/shared-types';

export interface EventHandlerContext {
  tx: Transaction;
  organizationId: OrganizationId;
  projectId: ProjectId;
}

export interface IEventHandler<TEvent extends V1Event = V1Event> {
  readonly eventType: TEvent['eventType'];
  handle(event: TEvent, ctx: EventHandlerContext): Promise<void>;
}

export const EVENT_HANDLER = Symbol('EVENT_HANDLER');
