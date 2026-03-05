import { type OrganizationId, type ProjectId, type ProjectTokenId } from '@assertly/shared-types';
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { timestamps, uuidv7PK } from './_common.js';
import { organizations } from './tenant.js';

export const projects = pgTable(
  'projects',
  {
    id: uuidv7PK<ProjectId>(),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('projects_org_name_idx').on(table.organizationId, table.name)],
);

export const projectTokens = pgTable(
  'project_tokens',
  {
    id: uuidv7PK<ProjectTokenId>(),
    projectId: uuid('project_id')
      .$type<ProjectId>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    tokenPrefix: varchar('token_prefix', { length: 16 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('project_tokens_prefix_idx').on(table.tokenPrefix),
    uniqueIndex('project_tokens_hash_idx').on(table.tokenHash),
    index('project_tokens_organization_id_idx').on(table.organizationId),
  ],
);
