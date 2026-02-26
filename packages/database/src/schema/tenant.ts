import { type OrganizationId, type UserId, MembershipRole } from '@assertly/shared-types';
import { pgEnum, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { timestamps, uuidv7PK } from './_common.js';

export const membershipRoleEnum = pgEnum(
  'membership_role',
  Object.values(MembershipRole) as [string, ...string[]],
);

export const organizations = pgTable('organizations', {
  id: uuidv7PK<OrganizationId>(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  ...timestamps,
});

export const users = pgTable('users', {
  id: uuidv7PK<UserId>(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  ...timestamps,
});

export const memberships = pgTable(
  'memberships',
  {
    id: uuidv7PK<string>(),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .$type<UserId>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex('memberships_org_user_idx').on(table.organizationId, table.userId)],
);
