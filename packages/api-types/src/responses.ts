import type {
  ArtifactId,
  OrganizationId,
  ProjectId,
  RunId,
  SuiteId,
  TestId,
  UserId,
} from '@assertly/shared-types';

export interface OrganizationSummary {
  id: OrganizationId;
  name: string;
  slug: string;
  role: string;
}

export interface ProjectSummary {
  id: ProjectId;
  name: string;
  slug: string;
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

export interface TestDetail extends TestSummary {
  updatedAt: string | null;
  artifacts: ArtifactSummary[];
}

export interface ArtifactSummary {
  id: ArtifactId;
  type: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
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
}

export interface UserProfile {
  id: UserId;
  email: string;
  name: string;
}
