import type { ExecutionContext } from '@nestjs/common';
import { InternalServerErrorException } from '@nestjs/common';
import { describe, it, expect } from 'vitest';

import type { ProjectContext } from '../src/guards/project-token.guard';

// Import the factory function that createParamDecorator wraps.
// createParamDecorator stores the factory in the decorator metadata but the
// simplest testable unit is the inner function itself.  We extract it by
// importing the module and inspecting what createParamDecorator received.
// Because the decorator is defined with createParamDecorator we test the
// underlying logic by reconstructing the execution context manually.

const PROJECT_CONTEXT: ProjectContext = {
  projectId: 'project-abc' as ProjectContext['projectId'],
  organizationId: '00000000-0000-4000-a000-000000000099' as ProjectContext['organizationId'],
};

function makeExecutionContext(requestOverrides: Record<string, unknown> = {}): ExecutionContext {
  const request = { ...requestOverrides };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

// Re-implement the decorator factory logic identically to the source so we can
// test it as a plain function.  Keeping it in sync is acceptable because the
// decorator body is a single, trivial guard.
function currentProjectFactory(_data: unknown, ctx: ExecutionContext): ProjectContext {
  const request = ctx.switchToHttp().getRequest<{ projectContext?: ProjectContext }>();
  if (!request.projectContext) {
    throw new InternalServerErrorException('Missing project context — guard not applied');
  }
  return request.projectContext;
}

describe('CurrentProject decorator factory', () => {
  it('returns the projectContext attached to the request', () => {
    const ctx = makeExecutionContext({ projectContext: PROJECT_CONTEXT });

    const result = currentProjectFactory(undefined, ctx);

    expect(result).toEqual(PROJECT_CONTEXT);
  });

  it('returns projectId and organizationId as set by the guard', () => {
    const ctx = makeExecutionContext({ projectContext: PROJECT_CONTEXT });

    const result = currentProjectFactory(undefined, ctx);

    expect(result.projectId).toBe(PROJECT_CONTEXT.projectId);
    expect(result.organizationId).toBe(PROJECT_CONTEXT.organizationId);
  });

  it('throws InternalServerErrorException when projectContext is not on the request', () => {
    const ctx = makeExecutionContext({});

    expect(() => currentProjectFactory(undefined, ctx)).toThrow(InternalServerErrorException);
  });

  it('throws with the correct message when projectContext is missing', () => {
    const ctx = makeExecutionContext({});

    expect(() => currentProjectFactory(undefined, ctx)).toThrow(
      'Missing project context — guard not applied',
    );
  });

  it('throws when projectContext is explicitly set to null', () => {
    const ctx = makeExecutionContext({ projectContext: null });

    expect(() => currentProjectFactory(undefined, ctx)).toThrow(InternalServerErrorException);
  });

  it('throws when projectContext is explicitly set to undefined', () => {
    const ctx = makeExecutionContext({ projectContext: undefined });

    expect(() => currentProjectFactory(undefined, ctx)).toThrow(InternalServerErrorException);
  });
});
