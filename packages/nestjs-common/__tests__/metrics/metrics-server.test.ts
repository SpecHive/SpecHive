import { once } from 'node:events';
import { type AddressInfo, createServer } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { startMetricsServer } from '../../src/metrics/metrics-server';
import type { MetricsService } from '../../src/metrics/metrics.service';

const CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

function createMockMetrics(overrides?: Partial<MetricsService>): MetricsService {
  return {
    getMetrics: vi.fn().mockResolvedValue('# HELP foo bar\nfoo 1\n'),
    getContentType: vi.fn().mockReturnValue(CONTENT_TYPE),
    ...overrides,
  } as unknown as MetricsService;
}

function createMockLogger() {
  return { error: vi.fn() };
}

async function request(
  port: number,
  method: string,
  path: string,
): Promise<{ status: number; body: string; contentType: string | undefined }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { method });
  return {
    status: res.status,
    body: await res.text(),
    contentType: res.headers.get('content-type') ?? undefined,
  };
}

describe('startMetricsServer', () => {
  const servers: Array<{ close: (cb?: () => void) => void }> = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
    );
    vi.restoreAllMocks();
  });

  async function start(metrics: MetricsService, logger = createMockLogger()) {
    const server = await startMetricsServer(metrics, 0, logger);
    servers.push(server);
    const { port } = server.address() as AddressInfo;
    return { server, logger, port };
  }

  it('returns 200 + prom body + content-type on GET /metrics', async () => {
    const metrics = createMockMetrics();
    const { port } = await start(metrics);

    const res = await request(port, 'GET', '/metrics');

    expect(res.status).toBe(200);
    expect(res.body).toBe('# HELP foo bar\nfoo 1\n');
    expect(res.contentType).toBe(CONTENT_TYPE);
    expect(metrics.getMetrics).toHaveBeenCalledOnce();
  });

  it('returns 404 for non-/metrics paths', async () => {
    const { port } = await start(createMockMetrics());

    const res = await request(port, 'GET', '/other');

    expect(res.status).toBe(404);
    expect(res.body).toMatch(/metrics available at get \/metrics/i);
  });

  it('returns 404 for non-GET methods on /metrics', async () => {
    const { port } = await start(createMockMetrics());

    const res = await request(port, 'POST', '/metrics');

    expect(res.status).toBe(404);
  });

  it('returns 500 with "error" body and logs when getMetrics throws', async () => {
    const metrics = createMockMetrics({
      getMetrics: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const { port, logger } = await start(metrics);

    const res = await request(port, 'GET', '/metrics');

    expect(res.status).toBe(500);
    expect(res.body).toBe('error\n');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), isTimeout: false }),
      'metrics scrape failed',
    );
  });

  it('returns 500 with "timeout" body when getMetrics exceeds SCRAPE_TIMEOUT_MS', async () => {
    const metrics = createMockMetrics({
      // Never resolves — forces the 5s internal timeout to fire
      getMetrics: vi.fn().mockReturnValue(new Promise<string>(() => {})),
    });
    const { port, logger } = await start(metrics);

    const res = await request(port, 'GET', '/metrics');

    expect(res.status).toBe(500);
    expect(res.body).toBe('timeout\n');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), isTimeout: true }),
      'metrics scrape failed',
    );
  }, 10_000);

  it('rejects listen when the port is already bound', async () => {
    // Grab a port by binding a stub server, then pass it to startMetricsServer.
    const stub = createServer();
    stub.listen(0, '0.0.0.0');
    await once(stub, 'listening');
    const { port } = stub.address() as AddressInfo;

    await expect(startMetricsServer(createMockMetrics(), port)).rejects.toThrow();

    await new Promise<void>((resolve) => stub.close(() => resolve()));
  });

  it('installs a long-lived error listener — emitting error after listen does not throw', async () => {
    const { server, logger } = await start(createMockMetrics());

    expect(() => server.emit('error', new Error('socket blew up'))).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'metrics server error',
    );
  });

  it('honors the bindAddress parameter', async () => {
    const metrics = createMockMetrics();
    const server = await startMetricsServer(metrics, 0, createMockLogger(), '127.0.0.1');
    servers.push(server);
    const { address } = server.address() as AddressInfo;

    expect(address).toBe('127.0.0.1');
  });
});
