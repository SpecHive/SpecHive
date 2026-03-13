import { MembershipRole } from '@spechive/shared-types';
import type { OrganizationId, UserId } from '@spechive/shared-types';
import { z } from 'zod';

export const JwtPayloadSchema = z.object({
  sub: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: z.nativeEnum(MembershipRole),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export interface UserContext {
  userId: UserId;
  organizationId: OrganizationId;
  role: MembershipRole;
}
