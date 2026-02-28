import type { MembershipRole } from '@assertly/shared-types';
import type { OrganizationId, UserId } from '@assertly/shared-types';

export interface JwtPayload {
  sub: string;
  organizationId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface UserContext {
  userId: UserId;
  organizationId: OrganizationId;
  role: MembershipRole;
}
