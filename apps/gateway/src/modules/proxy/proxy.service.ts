import type { IncomingHttpHeaders } from 'node:http';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProjectContext, UserContext } from '@spechive/nestjs-common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { EnvConfig } from '../config/env.validation';

/** Fastify request augmented by gateway auth guards. */
interface AuthenticatedGatewayRequest extends FastifyRequest {
  user?: UserContext;
  projectContext?: ProjectContext;
}

@Injectable()
export class ProxyService {
  private readonly ingestionApiUrl: string;
  private readonly queryApiUrl: string;

  constructor(config: ConfigService<EnvConfig>) {
    this.ingestionApiUrl = config.getOrThrow<string>('INGESTION_API_URL');
    this.queryApiUrl = config.getOrThrow<string>('QUERY_API_URL');
  }

  forwardToIngestion(req: FastifyRequest, reply: FastifyReply, path: string) {
    const upstream = `${this.ingestionApiUrl}${path}`;
    return reply.from(upstream, {
      rewriteRequestHeaders: (_origReq, headers) => this.injectHeaders(req, headers),
    });
  }

  forwardToQuery(req: FastifyRequest, reply: FastifyReply, path: string) {
    const upstream = `${this.queryApiUrl}${path}`;
    return reply.from(upstream, {
      rewriteRequestHeaders: (_origReq, headers) => this.injectHeaders(req, headers),
    });
  }

  private injectHeaders(req: FastifyRequest, headers: IncomingHttpHeaders): IncomingHttpHeaders {
    const authReq = req as AuthenticatedGatewayRequest;

    if (authReq.user) {
      headers['x-user-id'] = authReq.user.userId;
      headers['x-organization-id'] = authReq.user.organizationId;
      headers['x-user-role'] = authReq.user.role;
    }

    // Project-context headers. Routes are designed so that JWT guards and
    // ProjectTokenGuard are mutually exclusive — if both are ever present on the
    // same request, projectContext.organizationId takes precedence.
    if (authReq.projectContext) {
      headers['x-project-id'] = authReq.projectContext.projectId;
      headers['x-organization-id'] = authReq.projectContext.organizationId;
    }

    return headers;
  }
}
