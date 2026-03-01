export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  createdAt: string | null;
}

export interface RunSummary {
  id: string;
  projectId: string;
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

export interface TestSummary {
  id: string;
  suiteId: string;
  runId: string;
  name: string;
  status: string;
  durationMs: number;
  errorMessage: string | null;
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
  id: string;
  type: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: string | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface ArtifactDownloadResponse {
  url: string;
  expiresIn: number;
}
