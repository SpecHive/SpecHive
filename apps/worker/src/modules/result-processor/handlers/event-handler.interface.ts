import type { Transaction } from '@assertly/database';
import type { OrganizationId, ProjectId } from '@assertly/shared-types';

export interface EventHandlerContext {
  tx: Transaction;
  organizationId: OrganizationId;
  projectId: ProjectId;
}
