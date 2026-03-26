import { type ConfigService } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ProxyService } from '../src/modules/proxy/proxy.service';

function createMockConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    INGESTION_API_URL: 'http://ingestion:3001',
    QUERY_API_URL: 'http://query:3003',
  };
  const merged = { ...defaults, ...overrides };

  return {
    getOrThrow: vi.fn().mockImplementation((key: string) => {
      if (!(key in merged)) throw new Error(`Missing key: ${key}`);
      return merged[key];
    }),
  } as unknown as ConfigService;
}

function createMockReply() {
  const from = vi.fn();
  return { from } as unknown as { from: ReturnType<typeof vi.fn> };
}

function createMockRequest(extras: Record<string, unknown> = {}) {
  return { headers: {}, url: '/v1/test', ...extras } as never;
}

describe('ProxyService', () => {
  let service: ProxyService;
  let config: ConfigService;

  beforeEach(() => {
    config = createMockConfig();
    service = new ProxyService(config);
  });

  it('forwardToIngestion constructs correct upstream URL', () => {
    const reply = createMockReply();
    const req = createMockRequest();

    service.forwardToIngestion(req, reply as never, '/v1/events');

    expect(reply.from).toHaveBeenCalledWith('http://ingestion:3001/v1/events', expect.any(Object));
  });

  it('forwardToQuery constructs correct upstream URL', () => {
    const reply = createMockReply();
    const req = createMockRequest();

    service.forwardToQuery(req, reply as never, '/v1/auth/login');

    expect(reply.from).toHaveBeenCalledWith('http://query:3003/v1/auth/login', expect.any(Object));
  });

  it('injectHeaders adds user context headers', () => {
    const reply = createMockReply();
    const req = createMockRequest({
      user: { userId: 'user-1', organizationId: 'org-1', role: 'admin' },
    });

    service.forwardToIngestion(req, reply as never, '/v1/events');

    const options = reply.from.mock.calls[0]![1] as {
      rewriteRequestHeaders: (
        orig: unknown,
        headers: Record<string, string>,
      ) => Record<string, string>;
    };
    const headers = options.rewriteRequestHeaders(null, {});

    expect(headers).toMatchObject({
      'x-user-id': 'user-1',
      'x-organization-id': 'org-1',
      'x-user-role': 'admin',
    });
  });

  it('injectHeaders adds project context headers', () => {
    const reply = createMockReply();
    const req = createMockRequest({
      projectContext: { projectId: 'proj-1', organizationId: 'org-2' },
    });

    service.forwardToIngestion(req, reply as never, '/v1/events');

    const options = reply.from.mock.calls[0]![1] as {
      rewriteRequestHeaders: (
        orig: unknown,
        headers: Record<string, string>,
      ) => Record<string, string>;
    };
    const headers = options.rewriteRequestHeaders(null, {});

    expect(headers).toMatchObject({
      'x-project-id': 'proj-1',
      'x-organization-id': 'org-2',
    });
  });

  it('injectHeaders: projectContext org takes precedence when both contexts present', () => {
    const reply = createMockReply();
    const req = createMockRequest({
      user: { userId: 'user-1', organizationId: 'org-jwt', role: 'admin' },
      projectContext: { projectId: 'proj-1', organizationId: 'org-project' },
    });

    service.forwardToIngestion(req, reply as never, '/v1/events');

    const options = reply.from.mock.calls[0]![1] as {
      rewriteRequestHeaders: (
        orig: unknown,
        headers: Record<string, string>,
      ) => Record<string, string>;
    };
    const headers = options.rewriteRequestHeaders(null, {});

    expect(headers['x-organization-id']).toBe('org-project');
    expect(headers['x-user-id']).toBe('user-1');
    expect(headers['x-project-id']).toBe('proj-1');
  });

  it('injectHeaders passes headers through unchanged when no auth context', () => {
    const reply = createMockReply();
    const req = createMockRequest();

    service.forwardToIngestion(req, reply as never, '/v1/events');

    const options = reply.from.mock.calls[0]![1] as {
      rewriteRequestHeaders: (
        orig: unknown,
        headers: Record<string, string>,
      ) => Record<string, string>;
    };
    const original = { 'content-type': 'application/json' };
    const headers = options.rewriteRequestHeaders(null, { ...original });

    expect(headers).toEqual(original);
  });
});
