import http from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import https from 'node:https';

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
  private readonly corsOrigin: string;

  constructor(config: ConfigService<EnvConfig>) {
    this.ingestionApiUrl = config.getOrThrow<string>('INGESTION_API_URL');
    this.queryApiUrl = config.getOrThrow<string>('QUERY_API_URL');
    this.corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');
  }

  forwardToIngestion(req: FastifyRequest, reply: FastifyReply, path: string) {
    const upstream = `${this.ingestionApiUrl}${path}`;
    return reply.from(upstream, {
      rewriteRequestHeaders: (_origReq, headers) => this.injectHeaders(req, headers),
      rewriteHeaders: (headers) => this.stripUpstreamCorsHeaders(headers),
    });
  }

  forwardToQuery(req: FastifyRequest, reply: FastifyReply, path: string) {
    const upstream = `${this.queryApiUrl}${path}`;
    return reply.from(upstream, {
      rewriteRequestHeaders: (_origReq, headers) => this.injectHeaders(req, headers),
      rewriteHeaders: (headers) => this.stripUpstreamCorsHeaders(headers),
    });
  }

  /**
   * Stream an SSE response from query-api directly to the client,
   * bypassing @fastify/reply-from which buffers responses.
   */
  streamToQuery(req: FastifyRequest, reply: FastifyReply, path: string): void {
    reply.hijack();
    const upstream = new URL(`${this.queryApiUrl}${path}`);
    const headers: Record<string, string> = {};
    this.injectHeaders(req, headers);

    const transport = upstream.protocol === 'https:' ? https : http;

    const proxyReq = transport.request(
      {
        hostname: upstream.hostname,
        port: upstream.port,
        path: upstream.pathname + upstream.search,
        method: 'GET',
        headers,
      },
      (proxyRes) => {
        const status = proxyRes.statusCode ?? 502;

        const corsHeaders = {
          'access-control-allow-origin': this.corsOrigin,
          'access-control-allow-credentials': 'true',
        };

        if (status === 200) {
          reply.raw.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
            'x-accel-buffering': 'no',
            ...corsHeaders,
          });
        } else {
          reply.raw.writeHead(status, {
            'content-type': proxyRes.headers['content-type'] ?? 'application/json',
            ...corsHeaders,
          });
        }
        proxyRes.pipe(reply.raw);
      },
    );

    proxyReq.on('error', () => {
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(502);
      }
      reply.raw.end();
    });

    req.raw.on('close', () => proxyReq.destroy());
    proxyReq.end();
  }

  /** Prevent upstream CORS headers from leaking through the proxy — the gateway owns CORS. */
  private stripUpstreamCorsHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
    delete headers['access-control-allow-origin'];
    delete headers['access-control-allow-credentials'];
    delete headers['access-control-allow-methods'];
    delete headers['access-control-allow-headers'];
    delete headers['access-control-expose-headers'];
    delete headers['access-control-max-age'];
    return headers;
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
