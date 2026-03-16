import { Controller, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@spechive/nestjs-common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { ProxyService } from '../proxy.service';

@Controller('v1/auth')
export class AuthProxyController {
  constructor(private readonly proxy: ProxyService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, '/v1/auth/register');
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, '/v1/auth/login');
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, '/v1/auth/refresh');
  }

  @Post('logout')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  logout(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, '/v1/auth/logout');
  }

  @Post('change-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    return this.proxy.forwardToQuery(req, reply, '/v1/auth/change-password');
  }
}
