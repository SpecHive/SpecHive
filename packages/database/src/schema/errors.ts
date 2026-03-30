import {
  type ErrorGroupId,
  type ErrorOccurrenceId,
  type OrganizationId,
  type ProjectId,
  type RunId,
  type TestId,
} from '@spechive/shared-types';
import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { timestamps, uuidv7PK } from './_common.js';
import { runs } from './execution.js';
import { projects } from './project.js';
import { organizations } from './tenant.js';

export const errorGroups = pgTable(
  'error_groups',
  {
    id: uuidv7PK<ErrorGroupId>(),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .$type<ProjectId>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fingerprint: text('fingerprint').notNull(),
    title: text('title').notNull(),
    normalizedMessage: text('normalized_message').notNull(),
    errorName: text('error_name'),
    errorCategory: text('error_category'),
    totalOccurrences: integer('total_occurrences').notNull().default(0),
    uniqueTestCount: integer('unique_test_count').notNull().default(0),
    uniqueBranchCount: integer('unique_branch_count').notNull().default(0),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('uq_error_groups_fingerprint').on(table.projectId, table.fingerprint),
    index('idx_error_groups_project_last_seen').on(table.projectId, table.lastSeenAt),
    index('idx_error_groups_project_occurrences').on(table.projectId, table.totalOccurrences),
    index('idx_error_groups_org').on(table.organizationId),
  ],
);

export const errorOccurrences = pgTable(
  'error_occurrences',
  {
    id: uuidv7PK<ErrorOccurrenceId>(),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    errorGroupId: uuid('error_group_id')
      .$type<ErrorGroupId>()
      .notNull()
      .references(() => errorGroups.id, { onDelete: 'cascade' }),
    // No FK — tests table has composite PK (id, createdAt) for partitioning
    testId: uuid('test_id').$type<TestId>().notNull(),
    runId: uuid('run_id')
      .$type<RunId>()
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .$type<ProjectId>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    branch: text('branch'),
    commitSha: text('commit_sha'),
    testName: text('test_name').notNull(),
    errorMessage: text('error_message').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_error_occurrences_group').on(table.errorGroupId, table.occurredAt),
    index('idx_error_occurrences_run').on(table.runId),
    index('idx_error_occurrences_project_date').on(table.projectId, table.occurredAt),
    index('idx_error_occurrences_test').on(table.testId),
    index('idx_error_occurrences_branch').on(table.errorGroupId, table.branch),
    uniqueIndex('uq_error_occurrences_run_test').on(table.runId, table.testId),
  ],
);

export const dailyErrorStats = pgTable(
  'daily_error_stats',
  {
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .$type<ProjectId>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    errorGroupId: uuid('error_group_id')
      .$type<ErrorGroupId>()
      .notNull()
      .references(() => errorGroups.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    occurrences: integer('occurrences').notNull().default(0),
    uniqueTests: integer('unique_tests').notNull().default(0),
    uniqueBranches: integer('unique_branches').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.errorGroupId, table.date] }),
    index('idx_daily_error_stats_project_date').on(table.projectId, table.date),
  ],
);
