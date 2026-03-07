import type {
  ArtifactId,
  OrganizationId,
  ProjectId,
  ProjectTokenId,
  RunId,
  SuiteId,
  TestId,
  UserId,
} from '@assertly/shared-types';

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
}

export interface RunDetail extends RunSummary {
  suiteCount: number;
  metadata: unknown;
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
  refreshToken: string;
  user: UserProfile;
  organization: {
    id: OrganizationId;
    name: string;
    slug: string;
  };
}

export interface UserProfile {
  id: UserId;
  email: string;
  name: string;
}

export interface ProjectAnalyticsSummary {
  totalRuns: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  flakyTests: number;
  passRate: number;
  avgDurationMs: number;
  retriedTests: number;
}

export interface PassRateTrendPoint {
  date: string;
  passRate: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
}

export interface DurationTrendPoint {
  date: string;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
}

export interface FlakyTestSummary {
  testName: string;
  flakyCount: number;
  totalRuns: number;
  avgRetries: number;
}

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
}

export type TokenListResponse = PaginatedResponse<TokenListItem>;
