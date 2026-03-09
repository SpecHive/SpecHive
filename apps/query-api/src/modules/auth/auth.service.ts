import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { Database } from '@assertly/database';
import { setTenantContext } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import { MembershipRole, asOrganizationId, asUserId } from '@assertly/shared-types';
import type { OrganizationId, UserId } from '@assertly/shared-types';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash, verify } from 'argon2';
import { sql } from 'drizzle-orm';
import { SignJWT } from 'jose';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import type { EnvConfig } from '../config/env.validation';

import { generateSlug } from './generate-slug';
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
  role: MembershipRole;
};

type RefreshTokenRow = {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
};

@Injectable()
export class AuthService {
  private readonly jwtSecret: Uint8Array;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    config: ConfigService<EnvConfig>,
  ) {
    this.jwtSecret = new TextEncoder().encode(config.getOrThrow<string>('JWT_SECRET'));
    this.accessExpiresIn = config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');
    this.refreshExpiresIn = config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
  }

  async register(email: string, password: string, name: string, organizationName: string) {
    email = this.normalizeEmail(email);
    const passwordHash = await hash(password, { type: 2 });
    const baseSlug = generateSlug(organizationName);
    let slug = baseSlug;
    const orgId = uuidv7();
    const userId = uuidv7();
    const membershipId = uuidv7();

    const MAX_SLUG_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
      try {
        await this.executeRegister(
          orgId,
          userId,
          membershipId,
          email,
          passwordHash,
          name,
          organizationName,
          slug,
        );
        break;
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
          const detail = (err as { detail?: string }).detail ?? '';
          if (detail.includes('email')) {
            throw new ConflictException('An account with this email already exists');
          }
          if (detail.includes('slug')) {
            if (attempt === MAX_SLUG_RETRIES - 1) {
              throw new ConflictException(
                'Unable to generate a unique organization slug. Please try a different organization name.',
              );
            }
            slug = `${baseSlug}-${randomBytes(2).toString('hex')}`;
            continue;
          }
        }
        throw err;
      }
    }

    const token = await this.signToken({
      sub: userId,
      organizationId: orgId,
      role: MembershipRole.Owner,
    });

    const refreshToken = await this.createAndStoreRefreshToken(userId);

    return {
      token,
      refreshToken,
      user: { id: asUserId(userId), email, name },
      organization: { id: asOrganizationId(orgId), name: organizationName, slug },
    };
  }

  async login(email: string, password: string, organizationId?: string) {
    email = this.normalizeEmail(email);
    const users = await this.db.execute<AuthenticatedUser>(
      sql`SELECT * FROM authenticate_user_by_email(${email})`,
    );

    if (users.length === 0) {
      // Dummy verify to prevent timing oracle on user enumeration
      await verify(
        '$argon2id$v=19$m=65536,t=3,p=4$dGltaW5nLXNhZmU$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        password,
      ).catch(() => {});
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

    const refreshToken = await this.createAndStoreRefreshToken(user.id);

    return {
      token,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
      organization: {
        id: selectedOrg.organization_id,
        name: selectedOrg.organization_name,
        slug: selectedOrg.organization_slug,
      },
    };
  }

  async getProfile(userId: UserId, organizationId: OrganizationId) {
    const userProfileSchema = z.object({ id: z.string(), email: z.string(), name: z.string() });

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);
      const result = await tx.execute(
        sql`SELECT id, email, name FROM public.users WHERE id = ${userId}::uuid`,
      );
      const users = userProfileSchema.array().parse([...result]);

      if (users.length === 0) {
        throw new UnauthorizedException('User not found');
      }

      return users[0]!;
    });
  }

  async switchOrganization(userId: UserId, targetOrgId: OrganizationId) {
    const orgs = await this.db.execute<UserOrganization>(
      sql`SELECT * FROM get_user_organizations(${userId}::uuid)`,
    );

    const targetOrg = orgs.find((o) => o.organization_id === targetOrgId);
    if (!targetOrg) {
      throw new ForbiddenException('User is not a member of the requested organization');
    }

    const profile = await this.getProfile(userId, targetOrgId);

    const token = await this.signToken({
      sub: userId,
      organizationId: targetOrg.organization_id,
      role: targetOrg.role,
    });

    const refreshToken = await this.createAndStoreRefreshToken(userId);

    return {
      token,
      refreshToken,
      user: { id: profile.id, email: profile.email, name: profile.name },
      organization: {
        id: targetOrg.organization_id,
        name: targetOrg.organization_name,
        slug: targetOrg.organization_slug,
      },
    };
  }

  async refreshAccessToken(refreshTokenRaw: string, organizationId?: string) {
    const tokenHash = this.hashRefreshToken(refreshTokenRaw);
    const rows = await this.db.execute<RefreshTokenRow>(
      sql`SELECT * FROM find_refresh_token_by_hash(${tokenHash})`,
    );

    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const row = rows[0]!;

    if (row.revoked_at) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (new Date(row.expires_at) < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Revoke old refresh token (token rotation)
    await this.db.execute(sql`SELECT revoke_refresh_token(${tokenHash})`);

    const orgs = await this.db.execute<UserOrganization>(
      sql`SELECT * FROM get_user_organizations(${row.user_id}::uuid)`,
    );

    if (orgs.length === 0) {
      throw new ForbiddenException('User has no organization memberships');
    }

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
      sub: row.user_id,
      organizationId: selectedOrg.organization_id,
      role: selectedOrg.role,
    });

    const newRefreshToken = await this.createAndStoreRefreshToken(row.user_id);

    return {
      token,
      refreshToken: newRefreshToken,
      user: { id: row.user_id },
      organization: {
        id: selectedOrg.organization_id,
        name: selectedOrg.organization_name,
        slug: selectedOrg.organization_slug,
      },
    };
  }

  async logout(refreshTokenRaw: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshTokenRaw);
    await this.db.execute(sql`SELECT revoke_refresh_token(${tokenHash})`);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db.execute(sql`SELECT revoke_all_user_refresh_tokens(${userId}::uuid)`);
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

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private async executeRegister(
    orgId: string,
    userId: string,
    membershipId: string,
    email: string,
    passwordHash: string,
    name: string,
    orgName: string,
    slug: string,
  ) {
    await this.db.execute(
      sql`SELECT * FROM register_user(
        ${orgId}::uuid, ${userId}::uuid, ${membershipId}::uuid,
        ${email}, ${passwordHash}, ${name}, ${orgName}, ${slug}
      )`,
    );
  }

  private async signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(this.accessExpiresIn)
      .sign(this.jwtSecret);
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseExpiry(str: string): Date {
    const match = str.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiry format: ${str}`);
    }

    const value = parseInt(match[1]!, 10);
    const unit = match[2]!;

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * multipliers[unit]!);
  }

  private async createAndStoreRefreshToken(userId: string): Promise<string> {
    const raw = this.generateRefreshToken();
    const hash = this.hashRefreshToken(raw);
    const id = randomUUID();
    const expiresAt = this.parseExpiry(this.refreshExpiresIn);

    await this.db.execute(
      sql`SELECT store_refresh_token(${id}::uuid, ${userId}::uuid, ${hash}, ${expiresAt.toISOString()}::timestamptz)`,
    );

    return raw;
  }
}
