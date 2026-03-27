import type { ExecutionContext } from '@nestjs/common';
import { InternalServerErrorException } from '@nestjs/common';
import type { ProjectContext } from '@spechive/nestjs-common';
import { describe, it, expect } from 'vitest';

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
