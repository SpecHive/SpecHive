import { Controller, Delete, Get, HttpCode, Param, Post, Query, Body } from '@nestjs/common';
import { ZodValidationPipe } from '@spechive/nestjs-common';
import type { UserContext } from '@spechive/nestjs-common';
import type { InvitationId } from '@spechive/shared-types';
import { InvitationStatus, MembershipRole } from '@spechive/shared-types';
import { z } from 'zod';

import { paginationSchema, uuidSchema } from '../../common/pagination';
import { CurrentUser } from '../../decorators/current-user.decorator';
import { Public } from '../../decorators/public.decorator';
import { Roles } from '../../decorators/roles.decorator';

import { InvitationsService } from './invitations.service';

const createInvitationSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum([MembershipRole.Member, MembershipRole.Viewer]),
});

const listInvitationsSchema = paginationSchema.extend({
  status: z.nativeEnum(InvitationStatus).default(InvitationStatus.Pending),
});

@Controller('v1/invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @Roles(MembershipRole.Owner, MembershipRole.Admin)
  async create(
    @CurrentUser() user: UserContext,
    @Body(new ZodValidationPipe(createInvitationSchema))
    body: z.infer<typeof createInvitationSchema>,
  ) {
    return this.invitationsService.createInvitation(user.organizationId, user.userId, body);
  }

  @Get()
  async list(
    @CurrentUser() user: UserContext,
    @Query(new ZodValidationPipe(listInvitationsSchema))
    query: z.infer<typeof listInvitationsSchema>,
  ) {
    const { status, ...pagination } = query;
    return this.invitationsService.listInvitations(user.organizationId, status, pagination);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(MembershipRole.Owner, MembershipRole.Admin)
  async revoke(
    @CurrentUser() user: UserContext,
    @Param('id', new ZodValidationPipe(uuidSchema)) id: InvitationId,
  ) {
    await this.invitationsService.revokeInvitation(user.organizationId, id);
  }

  @Public()
  @Get('validate/:token')
  async validate(@Param('token') token: string) {
    return this.invitationsService.validateToken(token);
  }
}
