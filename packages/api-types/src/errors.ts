import { z } from 'zod';

// ── Error Group Summary (list endpoint) ──────────────────────────

export const errorGroupSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  normalizedMessage: z.string(),
  errorName: z.string().nullable(),
  errorCategory: z.string().nullable(),
  totalOccurrences: z.number(),
  uniqueTestCount: z.number(),
  uniqueBranchCount: z.number(),
  firstSeenAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
});

export type ErrorGroupSummary = z.infer<typeof errorGroupSummarySchema>;

// ── Error Timeline ───────────────────────────────────────────────

export const errorTimelineDataPointSchema = z.object({
  date: z.string(),
  occurrences: z.number(),
  uniqueTests: z.number(),
  uniqueBranches: z.number(),
});

export type ErrorTimelineDataPoint = z.infer<typeof errorTimelineDataPointSchema>;

export const errorTimelineSeriesSchema = z.object({
  errorGroupId: z.string(),
  title: z.string(),
  errorName: z.string().nullable(),
  dataPoints: errorTimelineDataPointSchema.array(),
});

export type ErrorTimelineSeries = z.infer<typeof errorTimelineSeriesSchema>;

export const errorTimelineResponseSchema = z.object({
  series: errorTimelineSeriesSchema.array(),
  otherSeries: errorTimelineDataPointSchema.array(),
});

export type ErrorTimelineResponse = z.infer<typeof errorTimelineResponseSchema>;

// ── Error Group Detail ──────────────────────────────────────────

export const affectedTestSchema = z.object({
  testName: z.string(),
  occurrenceCount: z.number(),
  lastSeenAt: z.string().nullable(),
  lastRunId: z.string().nullable(),
  lastTestId: z.string().nullable(),
});

export type AffectedTest = z.infer<typeof affectedTestSchema>;

export const affectedBranchSchema = z.object({
  branch: z.string().nullable(),
  occurrenceCount: z.number(),
  lastSeenAt: z.string().nullable(),
});

export type AffectedBranch = z.infer<typeof affectedBranchSchema>;

export const recentExecutionSchema = z.object({
  occurrenceId: z.string(),
  testId: z.string(),
  testName: z.string(),
  runId: z.string(),
  branch: z.string().nullable(),
  commitSha: z.string().nullable(),
  errorMessage: z.string().nullable(),
  occurredAt: z.string().nullable(),
});

export type RecentExecution = z.infer<typeof recentExecutionSchema>;

export const errorGroupDetailSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  fingerprint: z.string(),
  title: z.string(),
  normalizedMessage: z.string(),
  errorName: z.string().nullable(),
  errorCategory: z.string().nullable(),
  totalOccurrences: z.number(),
  uniqueTestCount: z.number(),
  uniqueBranchCount: z.number(),
  firstSeenAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  affectedTests: affectedTestSchema.array(),
  affectedBranches: affectedBranchSchema.array(),
  recentExecutions: recentExecutionSchema.array(),
});

export type ErrorGroupDetail = z.infer<typeof errorGroupDetailSchema>;

// ── Run Errors Summary ──────────────────────────────────────────

export const runErrorItemSchema = z.object({
  errorGroupId: z.string(),
  title: z.string(),
  errorName: z.string().nullable(),
  errorCategory: z.string().nullable(),
  occurrences: z.number(),
});

export type RunErrorItem = z.infer<typeof runErrorItemSchema>;

export const runErrorsSummarySchema = z.object({
  runId: z.string(),
  totalErrorGroups: z.number(),
  totalFailedTests: z.number(),
  topErrors: runErrorItemSchema.array(),
});

export type RunErrorsSummary = z.infer<typeof runErrorsSummarySchema>;
