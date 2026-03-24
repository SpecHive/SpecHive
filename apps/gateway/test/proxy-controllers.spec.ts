import { APP_GUARD } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { IS_PUBLIC_KEY, ProjectTokenGuard } from '@spechive/nestjs-common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { MockProjectTokenGuard, MockThrottlerGuard } from '../../../test/unit-helpers/mock-guards';
import { AuthProxyController } from '../src/modules/proxy/controllers/auth-proxy.controller';
import { IngestionProxyController } from '../src/modules/proxy/controllers/ingestion-proxy.controller';
import { QueryProxyController } from '../src/modules/proxy/controllers/query-proxy.controller';
import { ProxyService } from '../src/modules/proxy/proxy.service';

interface ProxyCall {
  target: 'ingestion' | 'query';
  path: string;
}

class MockProxyService {
  readonly calls: ProxyCall[] = [];

  forwardToIngestion(_req: unknown, reply: { send: (body: unknown) => void }, path: string) {
    this.calls.push({ target: 'ingestion', path });
    reply.send({ proxied: true });
  }

  forwardToQuery(_req: unknown, reply: { send: (body: unknown) => void }, path: string) {
    this.calls.push({ target: 'query', path });
    reply.send({ proxied: true });
  }
}

describe('Proxy Controllers', () => {
  let app: NestFastifyApplication;
  let mockProxy: MockProxyService;

  beforeAll(async () => {
    mockProxy = new MockProxyService();

    const moduleRef = await Test.createTestingModule({
      controllers: [IngestionProxyController, AuthProxyController, QueryProxyController],
      providers: [
        { provide: ProxyService, useValue: mockProxy },
        { provide: APP_GUARD, useClass: MockThrottlerGuard },
      ],
    })
      .overrideGuard(ProjectTokenGuard)
      .useClass(MockProjectTokenGuard)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/capabilities forwards to ingestion', async () => {
    mockProxy.calls.length = 0;

    const res = await app.inject({ method: 'GET', url: '/v1/capabilities' });

    expect(res.statusCode).toBeLessThan(400);
    expect(mockProxy.calls).toContainEqual({ target: 'ingestion', path: '/v1/capabilities' });
  });

  it('POST /v1/events forwards to ingestion', async () => {
    mockProxy.calls.length = 0;

    const res = await app.inject({ method: 'POST', url: '/v1/events' });

    expect(res.statusCode).toBeLessThan(400);
    expect(mockProxy.calls).toContainEqual({ target: 'ingestion', path: '/v1/events' });
  });

  it('POST /v1/artifacts/presign forwards to ingestion', async () => {
    mockProxy.calls.length = 0;

    const res = await app.inject({ method: 'POST', url: '/v1/artifacts/presign' });

    expect(res.statusCode).toBeLessThan(400);
    expect(mockProxy.calls).toContainEqual({ target: 'ingestion', path: '/v1/artifacts/presign' });
  });

  it('POST /v1/auth/login forwards to query', async () => {
    mockProxy.calls.length = 0;

    const res = await app.inject({ method: 'POST', url: '/v1/auth/login' });

    expect(res.statusCode).toBeLessThan(400);
    expect(mockProxy.calls).toContainEqual({ target: 'query', path: '/v1/auth/login' });
  });

  it('POST /v1/auth/register forwards to query', async () => {
    mockProxy.calls.length = 0;

    const res = await app.inject({ method: 'POST', url: '/v1/auth/register' });

    expect(res.statusCode).toBeLessThan(400);
    expect(mockProxy.calls).toContainEqual({ target: 'query', path: '/v1/auth/register' });
  });

  it('POST /v1/auth/change-password forwards to query', async () => {
    mockProxy.calls.length = 0;

    const res = await app.inject({ method: 'POST', url: '/v1/auth/change-password' });

    expect(res.statusCode).toBeLessThan(400);
    expect(mockProxy.calls).toContainEqual({ target: 'query', path: '/v1/auth/change-password' });
  });

  it('GET /v1/organizations forwards to query via catch-all', async () => {
    mockProxy.calls.length = 0;

    const res = await app.inject({ method: 'GET', url: '/v1/organizations' });

    expect(res.statusCode).toBeLessThan(400);
    expect(mockProxy.calls).toContainEqual({ target: 'query', path: '/v1/organizations' });
  });

  it('IngestionProxyController has @Public() metadata', () => {
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, IngestionProxyController);

    expect(isPublic).toBe(true);
  });
});
