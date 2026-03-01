import type { MembershipRole } from '@assertly/shared-types';
import type { OrganizationId, UserId } from '@assertly/shared-types';
import { z } from 'zod';

export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member']),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

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
