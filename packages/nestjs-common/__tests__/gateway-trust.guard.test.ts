import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, it, expect } from 'vitest';

import { GatewayTrustGuard } from '../src/auth/gateway-trust.guard';

const USER_ID = '019caa05-18f9-73f3-979e-a91d0dd0552f';
const ORG_ID = '019caa05-18f9-73f3-979e-a91d0dd05530';
const PROJECT_ID = '019caa05-18f9-73f3-979e-a91d0dd05531';

function makeContext(
  headers: Record<string, string | string[]> = {},
  handlerMeta: Record<string, unknown> = {},
) {
  const request: Record<string, unknown> = { headers };
  const handler = () => {};
  const klass = class {};

  for (const [key, value] of Object.entries(handlerMeta)) {
    Reflect.defineMetadata(key, value, handler);
  }

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => klass,
    request,
  } as never;
}

describe('GatewayTrustGuard', () => {
  const guard = new GatewayTrustGuard(new Reflector());

  it('sets request.user and returns true for valid user headers', () => {
    const ctx = makeContext({
      'x-user-id': USER_ID,
      'x-organization-id': ORG_ID,
      'x-user-role': 'member',
    });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    const { request } = ctx as unknown as { request: Record<string, unknown> };
    expect(request.user).toEqual({
      userId: USER_ID,
      organizationId: ORG_ID,
      role: 'member',
    });
  });

  it('sets request.projectContext and returns true for valid project headers', () => {
    const ctx = makeContext({
      'x-project-id': PROJECT_ID,
      'x-organization-id': ORG_ID,
    });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    const { request } = ctx as unknown as { request: Record<string, unknown> };
    expect(request.projectContext).toEqual({
      projectId: PROJECT_ID,
      organizationId: ORG_ID,
    });
  });

  it('sets both request.user and request.projectContext when both header sets present', () => {
    const ctx = makeContext({
      'x-user-id': USER_ID,
      'x-organization-id': ORG_ID,
      'x-user-role': 'member',
      'x-project-id': PROJECT_ID,
    });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    const { request } = ctx as unknown as { request: Record<string, unknown> };
    expect(request.user).toEqual({
      userId: USER_ID,
      organizationId: ORG_ID,
      role: 'member',
    });
    expect(request.projectContext).toEqual({
      projectId: PROJECT_ID,
      organizationId: ORG_ID,
    });
  });

  it('throws UnauthorizedException when no auth headers are present', () => {
    const ctx = makeContext({});

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException with "Incomplete user context headers" for partial user headers', () => {
    const ctx = makeContext({
      'x-user-id': USER_ID,
    });

    expect(() => guard.canActivate(ctx)).toThrow('Incomplete user context headers');
  });

  it('throws UnauthorizedException with "Missing organization context for project" when x-project-id present but x-organization-id missing', () => {
    const ctx = makeContext({
      'x-project-id': PROJECT_ID,
    });

    expect(() => guard.canActivate(ctx)).toThrow('Missing organization context for project');
  });

  it('returns true and sets no context for @Public() routes', () => {
    const ctx = makeContext({}, { isPublic: true });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    const { request } = ctx as unknown as { request: Record<string, unknown> };
    expect(request.user).toBeUndefined();
    expect(request.projectContext).toBeUndefined();
  });

  it('throws UnauthorizedException when only x-organization-id is present (no user or project context)', () => {
    const ctx = makeContext({ 'x-organization-id': ORG_ID });

    expect(() => guard.canActivate(ctx)).toThrow('Missing authentication context');
  });

  it('throws UnauthorizedException with "Invalid user role" for invalid MembershipRole value', () => {
    const ctx = makeContext({
      'x-user-id': USER_ID,
      'x-organization-id': ORG_ID,
      'x-user-role': 'superadmin',
    });

    expect(() => guard.canActivate(ctx)).toThrow('Invalid user role');
  });

  it('uses first value when headers are arrays', () => {
    const altUserId = '019caa05-18f9-73f3-979e-a91d0dd05532';
    const altOrgId = '019caa05-18f9-73f3-979e-a91d0dd05533';
    const ctx = makeContext({
      'x-user-id': [altUserId, USER_ID],
      'x-organization-id': [altOrgId, ORG_ID],
      'x-user-role': ['member', 'admin'],
    });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    const { request } = ctx as unknown as { request: Record<string, unknown> };
    expect(request.user).toEqual({
      userId: altUserId,
      organizationId: altOrgId,
      role: 'member',
    });
  });
});
