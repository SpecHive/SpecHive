import { All, Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Public } from '@spechive/nestjs-common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { ProxyService } from '../proxy.service';

@Controller('v1')
export class QueryProxyController {
  constructor(private readonly proxy: ProxyService) {}

  /** Public endpoint — unauthenticated users validate invite tokens during registration. */
  @Get('invitations/validate/:token')
  @Public()
  validateInvitation(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Param('token') token: string,
  ) {
    return this.proxy.forwardToQuery(req, reply, `/v1/invitations/validate/${token}`);
  }

  @Get('sse/events')
  streamEvents(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.streamToQuery(req, reply, '/v1/sse/events');
  }

  @All('*')
  catchAll(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }
}
