import { Controller, Delete, Patch, Post, Req, Res } from '@nestjs/common';
import { Roles } from '@spechive/nestjs-common';
import { MembershipRole } from '@spechive/shared-types';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { ProxyService } from '../proxy.service';

/**
 * Explicit routes for mutation endpoints that require Owner or Admin role.
 * NestJS route specificity ensures these match before the catch-all in QueryProxyController.
 */
@Controller('v1')
@Roles(MembershipRole.Owner, MembershipRole.Admin)
export class MutationProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Post('projects')
  createProject(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }

  @Patch('projects/:id')
  updateProject(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }

  @Delete('projects/:id')
  deleteProject(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }

  @Post('projects/:id/tokens')
  createToken(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }

  @Delete('projects/:id/tokens/:tokenId')
  revokeToken(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }

  @Post('invitations')
  createInvitation(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }

  @Delete('invitations/:id')
  revokeInvitation(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }

  @Patch('members/:id')
  updateMember(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }

  @Delete('members/:id')
  removeMember(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }
}
