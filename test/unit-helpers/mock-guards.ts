interface ProjectContext {
  projectId: string;
  organizationId: string;
}

const DEFAULT_MOCK_PROJECT_CONTEXT: ProjectContext = {
  projectId: 'project-abc',
  organizationId: '00000000-0000-4000-a000-000000000099',
};

/**
 * Mock ProjectTokenGuard that always passes and injects a mock project context.
 * Extracted from ingestion-api and artifacts controller specs.
 */
export class MockProjectTokenGuard {
  private readonly context: ProjectContext;

  constructor(context?: ProjectContext) {
    this.context = context ?? DEFAULT_MOCK_PROJECT_CONTEXT;
  }

  canActivate(executionContext: {
    switchToHttp(): { getRequest(): Record<string, unknown> };
  }): boolean {
    const request = executionContext.switchToHttp().getRequest();
    request.projectContext = this.context;
    return true;
  }
}

/** Mock ThrottlerGuard that always allows through. */
export class MockThrottlerGuard {
  canActivate(): boolean {
    return true;
  }
}
