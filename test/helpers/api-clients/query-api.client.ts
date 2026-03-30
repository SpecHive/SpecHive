import { AnalyticsClient } from './analytics.client';
import { ArtifactsClient } from './artifacts.client';
import { AuthClient } from './auth.client';
import { ErrorsClient } from './errors.client';
import { ProjectsClient } from './projects.client';
import { RunsClient } from './runs.client';
import { TokensClient } from './tokens.client';

/** Composed client for query-api (gateway). */
export class QueryApiClient {
  readonly auth: AuthClient;
  readonly projects: ProjectsClient;
  readonly tokens: TokensClient;
  readonly analytics: AnalyticsClient;
  readonly runs: RunsClient;
  readonly artifacts: ArtifactsClient;
  readonly errors: ErrorsClient;

  constructor(baseUrl: string) {
    this.auth = new AuthClient(baseUrl);
    this.projects = new ProjectsClient(baseUrl);
    this.tokens = new TokensClient(baseUrl);
    this.analytics = new AnalyticsClient(baseUrl);
    this.runs = new RunsClient(baseUrl);
    this.artifacts = new ArtifactsClient(baseUrl);
    this.errors = new ErrorsClient(baseUrl);
  }
}
