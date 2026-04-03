import { type ConfigService } from '@nestjs/config';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockHttpRequest = vi.hoisted(() => vi.fn());

vi.mock('node:http', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    default: { ...original, request: mockHttpRequest },
    request: mockHttpRequest,
  };
});

import { ProxyService } from '../src/modules/proxy/proxy.service';

function createMockConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    INGESTION_API_URL: 'http://ingestion:3001',
    QUERY_API_URL: 'http://query:3003',
    CORS_ORIGIN: 'http://localhost:5173',
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

  describe('streamToQuery', () => {
    function createSseReply() {
      const raw = {
        writeHead: vi.fn(),
        end: vi.fn(),
      };
      return {
        hijack: vi.fn(),
        raw,
      };
    }

    function createSseRequest(extras: Record<string, unknown> = {}) {
      const rawOn = vi.fn();
      return {
        headers: {},
        url: '/v1/sse/events',
        raw: { on: rawOn },
        ...extras,
      };
    }

    afterEach(() => {
      mockHttpRequest.mockReset();
    });

    it('hijacks reply and proxies SSE with correct headers on 200', () => {
      const reply = createSseReply();
      const req = createSseRequest();
      const mockPipe = vi.fn();

      mockHttpRequest.mockImplementation((_opts: unknown, callback: unknown) => {
        const cb = callback as (res: Record<string, unknown>) => void;
        cb({
          statusCode: 200,
          headers: {},
          pipe: mockPipe,
        });
        return { on: vi.fn(), end: vi.fn(), destroy: vi.fn() } as never;
      });

      service.streamToQuery(req as never, reply as never, '/v1/sse/events');

      expect(reply.hijack).toHaveBeenCalled();
      expect(reply.raw.writeHead).toHaveBeenCalledWith(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
        'access-control-allow-origin': 'http://localhost:5173',
        'access-control-allow-credentials': 'true',
      });
      expect(mockPipe).toHaveBeenCalledWith(reply.raw);
    });

    it('writes upstream status code for non-200 responses', () => {
      const reply = createSseReply();
      const req = createSseRequest();
      const mockPipe = vi.fn();

      mockHttpRequest.mockImplementation((_opts: unknown, callback: unknown) => {
        const cb = callback as (res: Record<string, unknown>) => void;
        cb({
          statusCode: 401,
          headers: { 'content-type': 'application/json' },
          pipe: mockPipe,
        });
        return { on: vi.fn(), end: vi.fn(), destroy: vi.fn() } as never;
      });

      service.streamToQuery(req as never, reply as never, '/v1/sse/events');

      expect(reply.raw.writeHead).toHaveBeenCalledWith(
        401,
        expect.objectContaining({
          'content-type': 'application/json',
        }),
      );
    });

    it('returns 502 on proxy request error', () => {
      const reply = createSseReply();
      const req = createSseRequest();
      let errorHandler: (() => void) | undefined;

      mockHttpRequest.mockImplementation(() => {
        return {
          on: vi.fn((event: string, handler: () => void) => {
            if (event === 'error') errorHandler = handler;
          }),
          end: vi.fn(),
          destroy: vi.fn(),
        } as never;
      });

      service.streamToQuery(req as never, reply as never, '/v1/sse/events');
      errorHandler!();

      expect(reply.raw.writeHead).toHaveBeenCalledWith(502);
      expect(reply.raw.end).toHaveBeenCalled();
    });

    it('destroys proxy request when client disconnects', () => {
      const reply = createSseReply();
      const req = createSseRequest();
      const mockDestroy = vi.fn();

      mockHttpRequest.mockImplementation(() => {
        return {
          on: vi.fn(),
          end: vi.fn(),
          destroy: mockDestroy,
        } as never;
      });

      service.streamToQuery(req as never, reply as never, '/v1/sse/events');

      // Capture and trigger the close handler
      const closeCall = (req.raw.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[0] === 'close',
      );
      expect(closeCall).toBeDefined();
      (closeCall![1] as () => void)();

      expect(mockDestroy).toHaveBeenCalled();
    });
  });
});
