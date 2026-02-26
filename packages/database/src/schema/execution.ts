import {
  type ArtifactId,
  type ProjectId,
  type RunId,
  type SuiteId,
  type TestId,
  ArtifactType,
  RunStatus,
  TestStatus,
} from '@assertly/shared-types';
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
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { timestamps, uuidv7PK } from './_common.js';
import { projects } from './project.js';

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
    status: runStatusEnum('status').notNull().default('pending'),
    totalTests: integer('total_tests').notNull().default(0),
    passedTests: integer('passed_tests').notNull().default(0),
    failedTests: integer('failed_tests').notNull().default(0),
    skippedTests: integer('skipped_tests').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    metadata: jsonb('metadata')
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => [
    index('runs_project_created_idx').on(table.projectId, table.createdAt),
    index('runs_project_status_idx').on(table.projectId, table.status),
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
    name: varchar('name', { length: 500 }).notNull(),
    parentSuiteId: uuid('parent_suite_id').$type<SuiteId>(),
    ...timestamps,
  },
  (table) => [
    index('suites_run_id_idx').on(table.runId),
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
    type: artifactTypeEnum('type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    storagePath: varchar('storage_path', { length: 1000 }).notNull(),
    sizeBytes: integer('size_bytes'),
    mimeType: varchar('mime_type', { length: 100 }),
    ...timestamps,
  },
  (table) => [index('artifacts_test_idx').on(table.testId)],
);
