import { relations } from 'drizzle-orm';

import { dailyRunStats, dailyFlakyTestStats } from './analytics.js';
import { refreshTokens } from './auth.js';
import { errorGroups, errorOccurrences } from './errors.js';
import { runs, suites, tests, artifacts, testAttempts } from './execution.js';
import { projects, projectTokens } from './project.js';
import { organizations, users, memberships, invitations } from './tenant.js';

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
  runs: many(runs),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  refreshTokens: many(refreshTokens),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  projectTokens: many(projectTokens),
  runs: many(runs),
  errorGroups: many(errorGroups),
}));

export const projectTokensRelations = relations(projectTokens, ({ one }) => ({
  project: one(projects, {
    fields: [projectTokens.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [projectTokens.organizationId],
    references: [organizations.id],
  }),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  project: one(projects, {
    fields: [runs.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [runs.organizationId],
    references: [organizations.id],
  }),
  suites: many(suites),
  tests: many(tests),
  errorOccurrences: many(errorOccurrences),
}));

export const suitesRelations = relations(suites, ({ one, many }) => ({
  run: one(runs, {
    fields: [suites.runId],
    references: [runs.id],
  }),
  parentSuite: one(suites, {
    fields: [suites.parentSuiteId],
    references: [suites.id],
    relationName: 'parentChild',
  }),
  childSuites: many(suites, { relationName: 'parentChild' }),
  tests: many(tests),
}));

export const testsRelations = relations(tests, ({ one, many }) => ({
  suite: one(suites, {
    fields: [tests.suiteId],
    references: [suites.id],
  }),
  run: one(runs, {
    fields: [tests.runId],
    references: [runs.id],
  }),
  errorGroup: one(errorGroups, {
    fields: [tests.errorGroupId],
    references: [errorGroups.id],
  }),
  artifacts: many(artifacts),
  attempts: many(testAttempts),
}));

export const testAttemptsRelations = relations(testAttempts, ({ one }) => ({
  test: one(tests, {
    fields: [testAttempts.testId],
    references: [tests.id],
  }),
  run: one(runs, {
    fields: [testAttempts.runId],
    references: [runs.id],
  }),
  organization: one(organizations, {
    fields: [testAttempts.organizationId],
    references: [organizations.id],
  }),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  test: one(tests, {
    fields: [artifacts.testId],
    references: [tests.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  invitedByUser: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const dailyRunStatsRelations = relations(dailyRunStats, ({ one }) => ({
  project: one(projects, {
    fields: [dailyRunStats.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [dailyRunStats.organizationId],
    references: [organizations.id],
  }),
}));

export const errorGroupsRelations = relations(errorGroups, ({ one, many }) => ({
  project: one(projects, {
    fields: [errorGroups.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [errorGroups.organizationId],
    references: [organizations.id],
  }),
  occurrences: many(errorOccurrences),
  // No tests back-relation — tests table uses composite PK (id, createdAt) which
  // prevents a standard FK, and tests.errorGroupId has no FK constraint.
}));

export const errorOccurrencesRelations = relations(errorOccurrences, ({ one }) => ({
  errorGroup: one(errorGroups, {
    fields: [errorOccurrences.errorGroupId],
    references: [errorGroups.id],
  }),
  run: one(runs, {
    fields: [errorOccurrences.runId],
    references: [runs.id],
  }),
  organization: one(organizations, {
    fields: [errorOccurrences.organizationId],
    references: [organizations.id],
  }),
}));

export const dailyFlakyTestStatsRelations = relations(dailyFlakyTestStats, ({ one }) => ({
  project: one(projects, {
    fields: [dailyFlakyTestStats.projectId],
    references: [projects.id],
  }),
  organization: one(organizations, {
    fields: [dailyFlakyTestStats.organizationId],
    references: [organizations.id],
  }),
}));
