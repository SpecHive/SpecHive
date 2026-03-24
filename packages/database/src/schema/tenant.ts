import {
  type InvitationId,
  type MembershipId,
  type OrganizationId,
  type UserId,
  InvitationStatus,
  MembershipRole,
} from '@spechive/shared-types';
import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

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
    id: uuidv7PK<MembershipId>(),
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
  (table) => [
    uniqueIndex('memberships_org_user_idx').on(table.organizationId, table.userId),
    index('memberships_user_id_idx').on(table.userId),
  ],
);

export const invitationStatusEnum = pgEnum(
  'invitation_status',
  Object.values(InvitationStatus) as [string, ...string[]],
);

export const invitations = pgTable(
  'invitations',
  {
    id: uuidv7PK<InvitationId>(),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 255 }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    role: membershipRoleEnum('role').notNull(),
    status: invitationStatusEnum('status').default('pending').notNull(),
    invitedBy: uuid('invited_by')
      .$type<UserId>()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index('invitations_org_status_idx').on(table.organizationId, table.status)],
);
