import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ProjectTokenGuard, Public } from '@spechive/nestjs-common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { ProxyService } from '../proxy.service';

@Controller('v1')
@Public()
@SkipThrottle()
export class IngestionProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Get('capabilities')
  capabilities(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToIngestion(req, reply, '/v1/capabilities');
  }

  @Post('events')
  @UseGuards(ProjectTokenGuard)
  events(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToIngestion(req, reply, '/v1/events');
  }

  @Post('artifacts/presign')
  @UseGuards(ProjectTokenGuard)
  artifactsPresign(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToIngestion(req, reply, '/v1/artifacts/presign');
  }
}
