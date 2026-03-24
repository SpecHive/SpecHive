import type { Transaction } from '@spechive/database';
import type { V1Event } from '@spechive/reporter-core-protocol';
import type { OrganizationId, ProjectId } from '@spechive/shared-types';

export interface EventHandlerContext {
  tx: Transaction;
  organizationId: OrganizationId;
  projectId: ProjectId;
}

export interface IEventHandler<TEvent extends V1Event = V1Event> {
  readonly eventType: TEvent['eventType'];
  handle(event: TEvent, ctx: EventHandlerContext): Promise<void>;
}
