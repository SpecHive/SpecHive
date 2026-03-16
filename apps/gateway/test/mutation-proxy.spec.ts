import { APP_GUARD } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { ProjectTokenGuard, ROLES_KEY, RolesGuard } from '@spechive/nestjs-common';
import { MembershipRole } from '@spechive/shared-types';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import {
  MockJwtAuthGuard,
  MockProjectTokenGuard,
  MockThrottlerGuard,
} from '../../../test/unit-helpers/mock-guards';
import { MutationProxyController } from '../src/modules/proxy/controllers/mutation-proxy.controller';
import { QueryProxyController } from '../src/modules/proxy/controllers/query-proxy.controller';
import { ProxyService } from '../src/modules/proxy/proxy.service';

interface ProxyCall {
  target: 'query';
  path: string;
}

class MockProxyService {
  readonly calls: ProxyCall[] = [];

  forwardToQuery(_req: unknown, reply: { send: (body: unknown) => void }, path: string) {
    this.calls.push({ target: 'query', path });
    reply.send({ proxied: true });
  }
}

const MUTATION_ENDPOINTS = [
  { method: 'POST' as const, url: '/v1/projects', label: 'create project' },
  { method: 'PATCH' as const, url: '/v1/projects/abc-123', label: 'update project' },
  { method: 'DELETE' as const, url: '/v1/projects/abc-123', label: 'delete project' },
  { method: 'POST' as const, url: '/v1/projects/abc-123/tokens', label: 'create token' },
  {
    method: 'DELETE' as const,
    url: '/v1/projects/abc-123/tokens/tok-456',
    label: 'revoke token',
  },
  { method: 'POST' as const, url: '/v1/invitations', label: 'create invitation' },
  { method: 'DELETE' as const, url: '/v1/invitations/inv-789', label: 'revoke invitation' },
  { method: 'PATCH' as const, url: '/v1/members/mem-123', label: 'update member' },
  { method: 'DELETE' as const, url: '/v1/members/mem-123', label: 'remove member' },
];

describe('MutationProxyController RBAC', () => {
  let app: NestFastifyApplication;
  let mockProxy: MockProxyService;

  beforeAll(async () => {
    mockProxy = new MockProxyService();

    const moduleRef = await Test.createTestingModule({
      controllers: [MutationProxyController, QueryProxyController],
      providers: [
        { provide: ProxyService, useValue: mockProxy },
        { provide: APP_GUARD, useClass: MockThrottlerGuard },
        { provide: APP_GUARD, useClass: MockJwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
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

  beforeEach(() => {
    mockProxy.calls.length = 0;
    MockJwtAuthGuard.role = 'admin';
  });

  describe('metadata', () => {
    it('MutationProxyController has @Roles(Owner, Admin) at class level', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, MutationProxyController);
      expect(roles).toEqual([MembershipRole.Owner, MembershipRole.Admin]);
    });
  });

  describe('Owner access', () => {
    beforeEach(() => {
      MockJwtAuthGuard.role = MembershipRole.Owner;
    });

    for (const { method, url, label } of MUTATION_ENDPOINTS) {
      it(`allows ${label} (${method} ${url})`, async () => {
        const res = await app.inject({ method, url });
        expect(res.statusCode).toBeLessThan(400);
      });
    }
  });

  describe('Admin access', () => {
    beforeEach(() => {
      MockJwtAuthGuard.role = MembershipRole.Admin;
    });

    for (const { method, url, label } of MUTATION_ENDPOINTS) {
      it(`allows ${label} (${method} ${url})`, async () => {
        const res = await app.inject({ method, url });
        expect(res.statusCode).toBeLessThan(400);
      });
    }
  });

  describe('Member access (denied)', () => {
    beforeEach(() => {
      MockJwtAuthGuard.role = MembershipRole.Member;
    });

    for (const { method, url, label } of MUTATION_ENDPOINTS) {
      it(`denies ${label} (${method} ${url}) with 403`, async () => {
        const res = await app.inject({ method, url });
        expect(res.statusCode).toBe(403);
      });
    }
  });

  describe('Viewer access (denied)', () => {
    beforeEach(() => {
      MockJwtAuthGuard.role = MembershipRole.Viewer;
    });

    for (const { method, url, label } of MUTATION_ENDPOINTS) {
      it(`denies ${label} (${method} ${url}) with 403`, async () => {
        const res = await app.inject({ method, url });
        expect(res.statusCode).toBe(403);
      });
    }
  });

  describe('read endpoints (all roles allowed)', () => {
    for (const role of [
      MembershipRole.Owner,
      MembershipRole.Admin,
      MembershipRole.Member,
      MembershipRole.Viewer,
    ]) {
      it(`allows GET /v1/projects for ${role}`, async () => {
        MockJwtAuthGuard.role = role;
        const res = await app.inject({ method: 'GET', url: '/v1/projects' });
        expect(res.statusCode).toBeLessThan(400);
      });
    }
  });

  describe('routing', () => {
    it('mutation requests are proxied to query-api', async () => {
      MockJwtAuthGuard.role = MembershipRole.Admin;
      await app.inject({ method: 'POST', url: '/v1/projects' });
      expect(mockProxy.calls).toContainEqual({ target: 'query', path: '/v1/projects' });
    });
  });
});
