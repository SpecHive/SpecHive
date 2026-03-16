import {
  type ArtifactId,
  type OrganizationId,
  type ProjectId,
  type RunId,
  type SuiteId,
  type TestAttemptId,
  type TestId,
  ArtifactType,
  RunStatus,
  TestStatus,
} from '@spechive/shared-types';
import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { timestamps, uuidv7PK } from './_common.js';
import { projects } from './project.js';
import { organizations } from './tenant.js';

export const runStatusEnum = pgEnum(
  'run_status',
  Object.values(RunStatus) as [string, ...string[]],
);

export const testStatusEnum = pgEnum(
  'test_status',
  Object.values(TestStatus) as [string, ...string[]],
);

export const artifactTypeEnum = pgEnum(
  'artifact_type',
  Object.values(ArtifactType) as [string, ...string[]],
);

export const runs = pgTable(
  'runs',
  {
    id: uuidv7PK<RunId>(),
    projectId: uuid('project_id')
      .$type<ProjectId>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 500 }),
    status: runStatusEnum('status').notNull().default('pending'),
    totalTests: integer('total_tests').notNull().default(0),
    passedTests: integer('passed_tests').notNull().default(0),
    failedTests: integer('failed_tests').notNull().default(0),
    skippedTests: integer('skipped_tests').notNull().default(0),
    flakyTests: integer('flaky_tests').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    branch: varchar('branch', { length: 500 }),
    commitSha: varchar('commit_sha', { length: 40 }),
    ciProvider: varchar('ci_provider', { length: 50 }),
    ciUrl: text('ci_url'),
    ...timestamps,
  },
  (table) => [
    index('runs_project_created_idx').on(table.projectId, table.createdAt),
    index('runs_project_status_idx').on(table.projectId, table.status),
    index('runs_organization_id_idx').on(table.organizationId),
    index('runs_project_finished_idx')
      .on(table.projectId, sql`${table.finishedAt} DESC`)
      .where(sql`${table.finishedAt} IS NOT NULL`),
    index('runs_project_branch_idx').on(table.projectId, table.branch),
  ],
);

export const suites = pgTable(
  'suites',
  {
    id: uuidv7PK<SuiteId>(),
    runId: uuid('run_id')
      .$type<RunId>()
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 500 }).notNull(),
    parentSuiteId: uuid('parent_suite_id').$type<SuiteId>(),
    ...timestamps,
  },
  (table) => [
    index('suites_run_name_idx').on(table.runId, table.name),
    index('suites_run_id_idx').on(table.runId),
    index('suites_organization_id_idx').on(table.organizationId),
    index('suites_parent_suite_id_idx').on(table.parentSuiteId),
    foreignKey({
      columns: [table.parentSuiteId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
  ],
);

export const tests = pgTable(
  'tests',
  {
    id: uuidv7PK<TestId>(),
    suiteId: uuid('suite_id')
      .$type<SuiteId>()
      .notNull()
      .references(() => suites.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .$type<RunId>()
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 500 }).notNull(),
    status: testStatusEnum('status').notNull().default('pending'),
    durationMs: integer('duration_ms'),
    errorMessage: text('error_message'),
    stackTrace: text('stack_trace'),
    retryCount: integer('retry_count').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('tests_suite_idx').on(table.suiteId),
    index('tests_run_status_idx').on(table.runId, table.status),
    index('tests_organization_id_idx').on(table.organizationId),
    index('tests_run_created_idx').on(table.runId, table.createdAt),
    index('tests_run_name_idx').on(table.runId, table.name),
    index('tests_flaky_run_idx')
      .on(table.runId)
      .where(sql`status = 'flaky'`),
  ],
);

export const artifacts = pgTable(
  'artifacts',
  {
    id: uuidv7PK<ArtifactId>(),
    testId: uuid('test_id')
      .$type<TestId>()
      .notNull()
      .references(() => tests.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    type: artifactTypeEnum('type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    storagePath: varchar('storage_path', { length: 1000 }).notNull(),
    sizeBytes: integer('size_bytes'),
    retryIndex: integer('retry_index'),
    mimeType: varchar('mime_type', { length: 100 }),
    ...timestamps,
  },
  (table) => [
    index('artifacts_test_idx').on(table.testId),
    index('artifacts_organization_id_idx').on(table.organizationId),
    index('artifacts_created_at_idx').on(table.createdAt),
  ],
);

export const testAttempts = pgTable(
  'test_attempts',
  {
    id: uuidv7PK<TestAttemptId>(),
    testId: uuid('test_id')
      .$type<TestId>()
      .notNull()
      .references(() => tests.id, { onDelete: 'cascade' }),
    runId: uuid('run_id')
      .$type<RunId>()
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    retryIndex: integer('retry_index').notNull(),
    // test_status enum reused; only passed/failed/skipped used for attempts
    status: testStatusEnum('status').notNull(),
    durationMs: integer('duration_ms'),
    errorMessage: text('error_message'),
    stackTrace: text('stack_trace'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('test_attempts_test_retry_idx').on(table.testId, table.retryIndex),
    index('test_attempts_organization_id_idx').on(table.organizationId),
    index('test_attempts_run_id_idx').on(table.runId),
  ],
);
