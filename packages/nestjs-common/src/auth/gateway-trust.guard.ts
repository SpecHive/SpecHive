import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole } from '@spechive/shared-types';
import type { OrganizationId, ProjectId, UserId } from '@spechive/shared-types';

import { IS_PUBLIC_KEY } from '../constants';

import type { ProjectContext } from './project-token.guard';
import type { UserContext } from './types';

function normalizeHeader(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  const result = Array.isArray(value) ? value[0] : value;
  return result || undefined;
}

/**
 * Trusts identity headers injected by the upstream gateway.
 *
 * SECURITY INVARIANTS:
 * 1. Backend services MUST NOT be reachable from outside the internal Docker network.
 * 2. The gateway MUST strip x-user-id, x-organization-id, x-user-role, x-project-id
 *    from every inbound request before proxying (see StripInternalHeadersMiddleware).
 */
@Injectable()
export class GatewayTrustGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const headers = request.headers;

    const userId = normalizeHeader(headers['x-user-id']);
    const orgId = normalizeHeader(headers['x-organization-id']);
    const role = normalizeHeader(headers['x-user-role']);
    const projectId = normalizeHeader(headers['x-project-id']);

    // User context — partial user headers = gateway bug → 401
    const hasAnyUserHeader = userId || role;
    if (hasAnyUserHeader && !(userId && orgId && role)) {
      throw new UnauthorizedException('Incomplete user context headers');
    }

    if (userId && orgId && role) {
      if (!Object.values(MembershipRole).includes(role as MembershipRole)) {
        throw new UnauthorizedException('Invalid user role');
      }

      request.user = {
        userId: userId as UserId,
        organizationId: orgId as OrganizationId,
        role: role as MembershipRole,
      } satisfies UserContext;
    }

    // Project context
    if (projectId) {
      if (!orgId) {
        throw new UnauthorizedException('Missing organization context for project');
      }

      request.projectContext = {
        projectId: projectId as ProjectId,
        organizationId: orgId as OrganizationId,
      } satisfies ProjectContext;
    }

    // Fail-closed: at least one context required
    if (!request.user && !request.projectContext) {
      throw new UnauthorizedException('Missing authentication context');
    }

    return true;
  }
}
