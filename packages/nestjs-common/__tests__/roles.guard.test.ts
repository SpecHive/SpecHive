import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { MembershipRole } from '@spechive/shared-types';
import { describe, it, expect, vi } from 'vitest';

import { ROLES_KEY } from '../src/auth/roles.decorator';
import { RolesGuard } from '../src/auth/roles.guard';
import { IS_PUBLIC_KEY } from '../src/constants';

function createMockReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: vi.fn().mockImplementation((key: string) => metadata[key]),
  } as unknown as Reflector;
}

function createMockContext(user?: { role: MembershipRole }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows when no @Roles metadata is set', () => {
    const reflector = createMockReflector({ [IS_PUBLIC_KEY]: undefined, [ROLES_KEY]: undefined });
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('allows when @Roles is an empty array', () => {
    const reflector = createMockReflector({ [IS_PUBLIC_KEY]: undefined, [ROLES_KEY]: [] });
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('allows when route is @Public()', () => {
    const reflector = createMockReflector({
      [IS_PUBLIC_KEY]: true,
      [ROLES_KEY]: [MembershipRole.Owner],
    });
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('allows Owner when @Roles(Owner, Admin)', () => {
    const reflector = createMockReflector({
      [IS_PUBLIC_KEY]: undefined,
      [ROLES_KEY]: [MembershipRole.Owner, MembershipRole.Admin],
    });
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext({ role: MembershipRole.Owner }))).toBe(true);
  });

  it('allows Admin when @Roles(Owner, Admin)', () => {
    const reflector = createMockReflector({
      [IS_PUBLIC_KEY]: undefined,
      [ROLES_KEY]: [MembershipRole.Owner, MembershipRole.Admin],
    });
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createMockContext({ role: MembershipRole.Admin }))).toBe(true);
  });

  it('denies Member when @Roles(Owner, Admin)', () => {
    const reflector = createMockReflector({
      [IS_PUBLIC_KEY]: undefined,
      [ROLES_KEY]: [MembershipRole.Owner, MembershipRole.Admin],
    });
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createMockContext({ role: MembershipRole.Member }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies Viewer when @Roles(Owner, Admin)', () => {
    const reflector = createMockReflector({
      [IS_PUBLIC_KEY]: undefined,
      [ROLES_KEY]: [MembershipRole.Owner, MembershipRole.Admin],
    });
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createMockContext({ role: MembershipRole.Viewer }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies when @Roles is set but no user context (fail closed)', () => {
    const reflector = createMockReflector({
      [IS_PUBLIC_KEY]: undefined,
      [ROLES_KEY]: [MembershipRole.Owner, MembershipRole.Admin],
    });
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createMockContext())).toThrow(ForbiddenException);
  });
});
