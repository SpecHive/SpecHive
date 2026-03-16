import type { OrganizationId, ProjectId } from '@spechive/shared-types';
import { bigint, date, index, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { timestamps } from './_common.js';
import { projects } from './project.js';
import { organizations } from './tenant.js';

export const dailyRunStats = pgTable(
  'daily_run_stats',
  {
    projectId: uuid('project_id')
      .$type<ProjectId>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    totalRuns: integer('total_runs').notNull().default(0),
    totalTests: integer('total_tests').notNull().default(0),
    passedTests: integer('passed_tests').notNull().default(0),
    failedTests: integer('failed_tests').notNull().default(0),
    skippedTests: integer('skipped_tests').notNull().default(0),
    flakyTests: integer('flaky_tests').notNull().default(0),
    // mode: 'number' is safe here — daily sums won't approach Number.MAX_SAFE_INTEGER (~9 quadrillion ms)
    sumDurationMs: bigint('sum_duration_ms', { mode: 'number' }).notNull().default(0),
    minDurationMs: integer('min_duration_ms'),
    maxDurationMs: integer('max_duration_ms'),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.day] }),
    index('daily_run_stats_org_project_day_idx').on(
      table.organizationId,
      table.projectId,
      table.day,
    ),
  ],
);

export const dailyFlakyTestStats = pgTable(
  'daily_flaky_test_stats',
  {
    projectId: uuid('project_id')
      .$type<ProjectId>()
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .$type<OrganizationId>()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    testName: text('test_name').notNull(),
    day: date('day', { mode: 'string' }).notNull(),
    flakyCount: integer('flaky_count').notNull().default(0),
    totalCount: integer('total_count').notNull().default(0),
    totalRetries: integer('total_retries').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.testName, table.day] }),
    index('daily_flaky_test_stats_org_project_day_idx').on(
      table.organizationId,
      table.projectId,
      table.day,
    ),
  ],
);
