import { z } from 'zod';

import type { PaginatedResponse } from './pagination.js';

// ── Error Group Summary (list endpoint) ──────────────────────────

export interface DateRangeMeta {
  from: string;
  to: string;
  clamped: boolean;
}

export type ErrorGroupListResponse = PaginatedResponse<ErrorGroupSummary> & {
  dateRange: DateRangeMeta;
};

export const errorGroupSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  normalizedMessage: z.string(),
  errorName: z.string().nullable(),
  errorCategory: z.string().nullable(),
  occurrences: z.number(),
  uniqueTests: z.number(),
  uniqueBranches: z.number(),
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
});

export type ErrorTimelineResponse = z.infer<typeof errorTimelineResponseSchema>;

// ── Error Group Detail ──────────────────────────────────────────

export const affectedTestSchema = z.object({
  testName: z.string(),
  occurrenceCount: z.number(),
  lastSeenAt: z.string().nullable(),
  lastRunId: z.string().nullable(),
  lastTestId: z.string().nullable(),
  lastBranch: z.string().nullable(),
});

export type AffectedTest = z.infer<typeof affectedTestSchema>;

export const affectedBranchSchema = z.object({
  branch: z.string().nullable(),
  occurrenceCount: z.number(),
  lastSeenAt: z.string().nullable(),
});

export type AffectedBranch = z.infer<typeof affectedBranchSchema>;

export const errorGroupDetailSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  fingerprint: z.string(),
  title: z.string(),
  normalizedMessage: z.string(),
  errorName: z.string().nullable(),
  errorCategory: z.string().nullable(),
  firstSeenAt: z.string().nullable(),
  /** Most recent occurrence within the requested date range. */
  lastSeenAt: z.string().nullable(),
  /** All-time most recent occurrence (not scoped to date range). */
  lastSeenAtAllTime: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  affectedTests: affectedTestSchema.array(),
  affectedBranches: affectedBranchSchema.array(),
  latestErrorMessage: z.string().nullable(),
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
