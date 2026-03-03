import type { Database } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { MembershipRole, OrganizationId, UserId } from '@assertly/shared-types';
import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'argon2';
import { sql } from 'drizzle-orm';
import { SignJWT } from 'jose';

import type { EnvConfig } from '../config/env.validation';

import type { JwtPayload } from './types';

type AuthenticatedUser = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
};

type UserOrganization = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
};

@Injectable()
export class AuthService {
  private readonly jwtSecret: Uint8Array;
  private readonly jwtExpiresIn: string;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    config: ConfigService<EnvConfig>,
  ) {
    this.jwtSecret = new TextEncoder().encode(config.getOrThrow<string>('JWT_SECRET'));
    this.jwtExpiresIn = config.getOrThrow<string>('JWT_EXPIRES_IN');
  }

  async login(email: string, password: string, organizationId?: string) {
    const users = await this.db.execute<AuthenticatedUser>(
      sql`SELECT * FROM authenticate_user_by_email(${email})`,
    );

    if (users.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = users[0]!;

    const isValid = await verify(user.password_hash, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const orgs = await this.db.execute<UserOrganization>(
      sql`SELECT * FROM get_user_organizations(${user.id}::uuid)`,
    );

    if (orgs.length === 0) {
      throw new ForbiddenException('User has no organization memberships');
    }

    // Use requested org or default to first
    let selectedOrg: UserOrganization;
    if (organizationId) {
      const found = orgs.find((o) => o.organization_id === organizationId);
      if (!found) {
        throw new ForbiddenException('User is not a member of the requested organization');
      }
      selectedOrg = found;
    } else {
      selectedOrg = orgs[0]!;
    }

    const token = await this.signToken({
      sub: user.id,
      organizationId: selectedOrg.organization_id,
      role: selectedOrg.role,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      organization: {
        id: selectedOrg.organization_id,
        name: selectedOrg.organization_name,
        slug: selectedOrg.organization_slug,
      },
    };
  }

  async getProfile(userId: UserId) {
    const users = (await this.db.execute(
      sql`SELECT id, email, name FROM public.users WHERE id = ${userId}::uuid`,
    )) as { id: string; email: string; name: string }[];

    if (users.length === 0) {
      throw new UnauthorizedException('User not found');
    }

    return users[0]!;
  }

  async switchOrganization(userId: UserId, targetOrgId: OrganizationId) {
    const orgs = await this.db.execute<UserOrganization>(
      sql`SELECT * FROM get_user_organizations(${userId}::uuid)`,
    );

    const targetOrg = orgs.find((o) => o.organization_id === targetOrgId);
    if (!targetOrg) {
      throw new ForbiddenException('User is not a member of the requested organization');
    }

    const profile = await this.getProfile(userId);

    const token = await this.signToken({
      sub: userId,
      organizationId: targetOrg.organization_id,
      role: targetOrg.role,
    });

    return {
      token,
      user: { id: profile.id, email: profile.email, name: profile.name },
      organization: {
        id: targetOrg.organization_id,
        name: targetOrg.organization_name,
        slug: targetOrg.organization_slug,
      },
    };
  }

  async getOrganizations(userId: UserId) {
    const orgs = await this.db.execute<UserOrganization>(
      sql`SELECT * FROM get_user_organizations(${userId}::uuid)`,
    );

    return orgs.map((o) => ({
      id: o.organization_id as OrganizationId,
      name: o.organization_name,
      slug: o.organization_slug,
      role: o.role as MembershipRole,
    }));
  }

  private async signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.jwtExpiresIn)
      .sign(this.jwtSecret);
  }
}
