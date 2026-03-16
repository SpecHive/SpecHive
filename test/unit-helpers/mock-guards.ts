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

interface UserContext {
  userId: string;
  organizationId: string;
  role: string;
}

const DEFAULT_MOCK_USER_CONTEXT: UserContext = {
  userId: '00000000-0000-4000-a000-000000000001',
  organizationId: '00000000-0000-4000-a000-000000000099',
  role: 'member',
};

const DEFAULT_GATEWAY_PROJECT_CONTEXT: ProjectContext = {
  projectId: 'project-abc',
  organizationId: '00000000-0000-4000-a000-000000000099',
};

/**
 * Mock JwtAuthGuard that always passes and injects a configurable user context.
 * Use static fields to change the role per-test without recreating the app.
 */
export class MockJwtAuthGuard {
  static role = 'admin';
  static userId = '00000000-0000-4000-a000-000000000001';
  static organizationId = '00000000-0000-4000-a000-000000000099';

  canActivate(executionContext: {
    switchToHttp(): { getRequest(): Record<string, unknown> };
  }): boolean {
    const request = executionContext.switchToHttp().getRequest();
    request.user = {
      userId: MockJwtAuthGuard.userId,
      organizationId: MockJwtAuthGuard.organizationId,
      role: MockJwtAuthGuard.role,
    };
    return true;
  }
}

/**
 * Mock GatewayTrustGuard that always passes and injects mock user and/or project context.
 */
export class MockGatewayTrustGuard {
  private readonly userContext: UserContext | undefined;
  private readonly projectContext: ProjectContext | undefined;

  constructor(opts?: { user?: UserContext; project?: ProjectContext }) {
    this.userContext = opts?.user ?? DEFAULT_MOCK_USER_CONTEXT;
    this.projectContext = opts?.project ?? DEFAULT_GATEWAY_PROJECT_CONTEXT;
  }

  canActivate(executionContext: {
    switchToHttp(): { getRequest(): Record<string, unknown> };
  }): boolean {
    const request = executionContext.switchToHttp().getRequest();
    if (this.userContext) request.user = this.userContext;
    if (this.projectContext) request.projectContext = this.projectContext;
    return true;
  }
}
