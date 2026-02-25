import { MembershipRole } from '@assertly/shared-types';
import { pgEnum, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { timestamps, uuidv7PK } from './_common.js';

export const membershipRoleEnum = pgEnum(
  'membership_role',
  Object.values(MembershipRole) as [string, ...string[]],
);

export const organizations = pgTable('organizations', {
  id: uuidv7PK(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  ...timestamps,
});

export const users = pgTable('users', {
  id: uuidv7PK(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  ...timestamps,
});

export const memberships = pgTable(
  'memberships',
  {
    id: uuidv7PK(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: membershipRoleEnum('role').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('memberships_org_user_idx').on(table.organizationId, table.userId)],
);
