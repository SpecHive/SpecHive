import { randomBytes } from 'node:crypto';

import type { Database } from '@assertly/database';
import { setTenantContext } from '@assertly/database';
import { invitations, users } from '@assertly/database';
import { DATABASE_CONNECTION } from '@assertly/nestjs-common';
import type { InvitationId, OrganizationId, UserId } from '@assertly/shared-types';
import { InvitationStatus, MembershipRole } from '@assertly/shared-types';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, count, desc, eq, sql } from 'drizzle-orm';

import { buildPaginatedResponse, getOffset } from '../../common/pagination';
import type { PaginationParams } from '../../common/pagination';
import type { EnvConfig } from '../config/env.validation';

type InvitationTokenRow = {
  invitation_id: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  email: string | null;
  role: string;
  status: string;
  expires_at: Date;
};

@Injectable()
export class InvitationsService {
  private readonly dashboardUrl: string;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    config: ConfigService<EnvConfig>,
  ) {
    this.dashboardUrl =
      config.get('DASHBOARD_URL') ?? config.get('CORS_ORIGIN') ?? 'http://localhost:5173';
  }

  async createInvitation(
    organizationId: OrganizationId,
    invitedBy: UserId,
    dto: { email?: string | undefined; role: MembershipRole },
  ) {
    const INVITABLE_ROLES = [MembershipRole.Member, MembershipRole.Viewer];
    if (!INVITABLE_ROLES.includes(dto.role)) {
      throw new BadRequestException('Invitations can only assign member or viewer roles');
    }

    const token = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const [created] = await tx
        .insert(invitations)
        .values({
          organizationId,
          email: dto.email?.toLowerCase().trim() ?? null,
          token,
          role: dto.role,
          invitedBy,
          expiresAt,
        })
        .returning({
          id: invitations.id,
          role: invitations.role,
          email: invitations.email,
          expiresAt: invitations.expiresAt,
        });

      const inviteUrl = `${this.dashboardUrl}/register?invite=${token}`;

      return {
        id: created!.id,
        token,
        inviteUrl,
        role: created!.role,
        email: created!.email,
        expiresAt: created!.expiresAt.toISOString(),
      };
    });
  }

  async listInvitations(
    organizationId: OrganizationId,
    status: InvitationStatus,
    pagination: PaginationParams,
  ) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const offset = getOffset(pagination.page, pagination.pageSize);
      const conditions = and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, status),
      );

      const [rows, totalResult] = await Promise.all([
        tx
          .select({
            id: invitations.id,
            email: invitations.email,
            role: invitations.role,
            status: invitations.status,
            invitedByName: users.name,
            expiresAt: invitations.expiresAt,
            createdAt: invitations.createdAt,
          })
          .from(invitations)
          .leftJoin(users, eq(invitations.invitedBy, users.id))
          .where(conditions)
          .orderBy(desc(invitations.createdAt))
          .limit(pagination.pageSize)
          .offset(offset),
        tx.select({ count: count() }).from(invitations).where(conditions),
      ]);

      const total = totalResult[0]?.count ?? 0;

      return buildPaginatedResponse(rows, total, pagination.page, pagination.pageSize);
    });
  }

  async revokeInvitation(organizationId: OrganizationId, invitationId: InvitationId) {
    return this.db.transaction(async (tx) => {
      await setTenantContext(tx, organizationId);

      const result = await tx
        .update(invitations)
        .set({ status: InvitationStatus.Revoked })
        .where(
          and(eq(invitations.id, invitationId), eq(invitations.status, InvitationStatus.Pending)),
        )
        .returning({ id: invitations.id });

      if (result.length === 0) {
        throw new NotFoundException('Invitation not found or not pending');
      }
    });
  }

  async validateToken(token: string) {
    const rows = await this.db.execute<InvitationTokenRow>(
      sql`SELECT * FROM validate_invitation_token(${token})`,
    );

    if (rows.length === 0) {
      return { valid: false };
    }

    const row = rows[0]!;
    if (row.status !== InvitationStatus.Pending || new Date(row.expires_at) < new Date()) {
      return { valid: false };
    }

    return {
      valid: true,
      organizationName: row.organization_name,
      role: row.role,
    };
  }
}
