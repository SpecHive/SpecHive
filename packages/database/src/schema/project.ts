import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { timestamps, uuidv7PK } from './_common.js';
import { organizations } from './tenant.js';

export const projects = pgTable(
  'projects',
  {
    id: uuidv7PK(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('projects_org_slug_idx').on(table.organizationId, table.slug)],
);

export const projectTokens = pgTable(
  'project_tokens',
  {
    id: uuidv7PK(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),
    name: varchar('name', { length: 255 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('project_tokens_hash_idx').on(table.tokenHash)],
);
