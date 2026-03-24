import type {
  ArtifactId,
  OrganizationId,
  ProjectId,
  ProjectTokenId,
  RunId,
  SuiteId,
  TestId,
  UserId,
} from '@spechive/shared-types';
import { z } from 'zod';

import type { PaginatedResponse } from './pagination.js';

export interface OrganizationSummary {
  id: OrganizationId;
  name: string;
  slug: string;
  role: string;
}

export interface ProjectSummary {
  id: ProjectId;
  name: string;
  createdAt: string | null;
}

export interface RunSummary {
  id: RunId;
  projectId: ProjectId;
  name: string | null;
  status: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  flakyTests: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
  branch: string | null;
  commitSha: string | null;
}

export interface RunDetail extends RunSummary {
  suiteCount: number;
  metadata: Record<string, unknown>;
  ciProvider: string | null;
  ciUrl: string | null;
  updatedAt: string | null;
}

export interface SuiteSummary {
  id: SuiteId;
  name: string;
  parentSuiteId: SuiteId | null;
  createdAt: string | null;
}

export interface TestSummary {
  id: TestId;
  suiteId: SuiteId;
  runId: RunId;
  name: string;
  status: string;
  durationMs: number | null;
  errorMessage: string | null;
  stackTrace: string | null;
  retryCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string | null;
}

export interface TestAttemptSummary {
  retryIndex: number;
  status: string;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  stackTrace: string | null;
}

export interface TestDetail extends TestSummary {
  updatedAt: string | null;
  artifacts: ArtifactSummary[];
  attempts: TestAttemptSummary[];
}

export interface ArtifactSummary {
  id: ArtifactId;
  type: string;
  name: string;
  sizeBytes: number | null;
  mimeType: string;
  retryIndex: number | null;
  createdAt: string | null;
}

export interface ArtifactDownloadResponse {
  url: string;
  expiresIn: number;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
  organization: {
    id: OrganizationId;
    name: string;
    slug: string;
  };
  role: string;
}

export interface UserProfile {
  id: UserId;
  email: string;
  name: string;
}

export const projectAnalyticsSummarySchema = z.object({
  totalRuns: z.number(),
  totalTests: z.number(),
  passedTests: z.number(),
  failedTests: z.number(),
  skippedTests: z.number(),
  flakyTests: z.number(),
  passRate: z.number(),
  avgDurationMs: z.number(),
  retriedTests: z.number(),
});

export const passRateTrendPointSchema = z.object({
  date: z.string(),
  passRate: z.number(),
  totalTests: z.number(),
  passedTests: z.number(),
  failedTests: z.number(),
});

export const durationTrendPointSchema = z.object({
  date: z.string(),
  avgDurationMs: z.number(),
  // null when no run in this bucket had a known startedAt — excluded from duration aggregates
  minDurationMs: z.number().nullable(),
  maxDurationMs: z.number().nullable(),
});

export const flakyTestSummarySchema = z.object({
  testName: z.string(),
  flakyCount: z.number(),
  totalRuns: z.number(),
  avgRetries: z.number(),
});

export type ProjectAnalyticsSummary = z.infer<typeof projectAnalyticsSummarySchema>;
export type PassRateTrendPoint = z.infer<typeof passRateTrendPointSchema>;
export type DurationTrendPoint = z.infer<typeof durationTrendPointSchema>;
export type FlakyTestSummary = z.infer<typeof flakyTestSummarySchema>;

// --- Organization-level analytics ---

export const organizationAnalyticsSummarySchema = projectAnalyticsSummarySchema.extend({
  projectCount: z.number(),
  passRateDelta: z.number().nullable(),
  flakyRate: z.number(),
  flakyRateDelta: z.number().nullable(),
});
export type OrganizationAnalyticsSummary = z.infer<typeof organizationAnalyticsSummarySchema>;

export const organizationFlakyTestSummarySchema = flakyTestSummarySchema.extend({
  projectId: z.string(),
  projectName: z.string(),
  flakyCountDelta: z.number().nullable(),
});
export type OrganizationFlakyTestSummary = z.infer<typeof organizationFlakyTestSummarySchema>;

export const sparklinePointSchema = z.object({
  date: z.string(),
  passRate: z.number(),
});

export const projectComparisonItemSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  totalRuns: z.number(),
  totalTests: z.number(),
  passedTests: z.number(),
  failedTests: z.number(),
  skippedTests: z.number(),
  flakyTests: z.number(),
  retriedTests: z.number(),
  passRate: z.number(),
  failRate: z.number(),
  flakyRate: z.number(),
  skipRate: z.number(),
  avgTestsPerRun: z.number(),
  avgDurationMs: z.number(),
  minDurationMs: z.number().nullable(),
  maxDurationMs: z.number().nullable(),
  passRateDelta: z.number().nullable(),
  flakyRateDelta: z.number().nullable(),
  avgDurationDelta: z.number().nullable(),
  dailyPassRates: sparklinePointSchema.array(),
  healthScore: z.number(),
});
export type ProjectComparisonItem = z.infer<typeof projectComparisonItemSchema>;

export const orgAverageSchema = z.object({
  passRate: z.number(),
  flakyRate: z.number(),
  skipRate: z.number(),
  avgDurationMs: z.number(),
  healthScore: z.number(),
  totalRuns: z.number(),
  retriedTests: z.number(),
  dailyPassRates: sparklinePointSchema.array(),
});

export const projectComparisonResponseSchema = z.object({
  projects: projectComparisonItemSchema.array(),
  orgAverage: orgAverageSchema,
});
export type ProjectComparisonResponse = z.infer<typeof projectComparisonResponseSchema>;

export interface CreateProjectRequest {
  name: string;
}

export interface ProjectResponse {
  id: ProjectId;
  name: string;
  organizationId: OrganizationId;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateTokenRequest {
  name: string;
}

export interface TokenCreatedResponse {
  id: ProjectTokenId;
  name: string;
  tokenPrefix: string;
  token: string;
  createdAt: string | null;
}

export interface TokenListItem {
  id: ProjectTokenId;
  name: string;
  tokenPrefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  projectId: ProjectId;
  projectName: string;
}

export type TokenListResponse = PaginatedResponse<TokenListItem>;

export interface InvitationCreatedResponse {
  id: string;
  token: string;
  inviteUrl: string;
  role: string;
  email: string | null;
  expiresAt: string;
}

export interface InvitationListItem {
  id: string;
  email: string | null;
  role: string;
  status: string;
  invitedByName: string;
  expiresAt: string;
  createdAt: string | null;
}

export interface InvitationValidation {
  valid: boolean;
  organizationName?: string;
  role?: string;
}

export interface MemberListItem {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  joinedAt: string | null;
}

export type InvitationListResponse = PaginatedResponse<InvitationListItem>;
export type MemberListResponse = PaginatedResponse<MemberListItem>;
