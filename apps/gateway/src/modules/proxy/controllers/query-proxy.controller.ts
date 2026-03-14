import { All, Controller, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { ProxyService } from '../proxy.service';

@Controller('v1')
export class QueryProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @All('*')
  catchAll(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, req.url);
  }
}
