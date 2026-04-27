import { HttpException, HttpStatus, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MetricsInterceptor } from '../../src/metrics/metrics.interceptor';
import type { MetricsService } from '../../src/metrics/metrics.service';

const mockCounter = { inc: vi.fn() };
const mockHistogram = { observe: vi.fn() };

function createMockMetricsService(enabled: boolean) {
  return {
    enabled,
    createCounter: vi.fn().mockReturnValue(mockCounter),
    createHistogram: vi.fn().mockReturnValue(mockHistogram),
  } as unknown as MetricsService;
}

function createMockExecutionContext(
  overrides: { method?: string; route?: string; statusCode?: number } = {},
) {
  const request: Record<string, unknown> = {
    method: overrides.method ?? 'GET',
    routeOptions: { url: overrides.route ?? '/api/test' },
  };

  const reply: Record<string, unknown> = {
    statusCode: overrides.statusCode ?? 200,
  };

  return {
    switchToHttp: vi.fn().mockReturnValue({
      getRequest: vi.fn().mockReturnValue(request),
      getResponse: vi.fn().mockReturnValue(reply),
    }),
  } as unknown as ExecutionContext;
}

function createMockCallHandler(error?: Error): CallHandler {
  return {
    handle: vi.fn().mockReturnValue(error ? throwError(() => error) : of(undefined)),
  } as unknown as CallHandler;
}

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    mockCounter.inc.mockClear();
    mockHistogram.observe.mockClear();
    interceptor = new MetricsInterceptor(createMockMetricsService(true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records HTTP request metrics on successful response', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

    const context = createMockExecutionContext({
      method: 'GET',
      route: '/api/users/:id',
      statusCode: 200,
    });

    interceptor.intercept(context, createMockCallHandler()).subscribe();

    await vi.waitFor(() => expect(mockCounter.inc).toHaveBeenCalledOnce());
    expect(mockCounter.inc).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/users/:id',
      status_code: '200',
    });
    expect(mockHistogram.observe).toHaveBeenCalledWith(
      { method: 'GET', route: '/api/users/:id', status_code: '200' },
      0.1,
    );
  });

  it('records correct status code for HttpException errors', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(50);

    const context = createMockExecutionContext({ method: 'POST', route: '/api/items' });
    const error = new HttpException('Not Found', HttpStatus.NOT_FOUND);
    const handler = createMockCallHandler(error);

    interceptor.intercept(context, handler).subscribe({ error: () => {} });

    await vi.waitFor(() => expect(mockCounter.inc).toHaveBeenCalledOnce());
    expect(mockCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', status_code: '404' }),
    );
  });

  it('records 500 for non-HttpException errors', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(50);

    const context = createMockExecutionContext({ method: 'POST', route: '/api/items' });

    interceptor
      .intercept(context, createMockCallHandler(new Error('unexpected')))
      .subscribe({ error: () => {} });

    await vi.waitFor(() => expect(mockCounter.inc).toHaveBeenCalledOnce());
    expect(mockCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', status_code: '500' }),
    );
  });

  it('re-throws the original error after recording metrics', async () => {
    const context = createMockExecutionContext();
    const originalError = new Error('original');

    const errors: unknown[] = [];
    interceptor
      .intercept(context, createMockCallHandler(originalError))
      .subscribe({ error: (e) => errors.push(e) });

    await vi.waitFor(() => expect(errors).toHaveLength(1));
    expect(errors[0]).toBe(originalError);
  });

  it('uses "unknown" route when routeOptions is undefined', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(50);

    const context = createMockExecutionContext({ method: 'POST' });
    const http = context.switchToHttp();
    const request = http.getRequest() as Record<string, unknown>;
    request.routeOptions = undefined;

    interceptor.intercept(context, createMockCallHandler()).subscribe();

    await vi.waitFor(() => expect(mockCounter.inc).toHaveBeenCalled());
    expect(mockCounter.inc).toHaveBeenCalledWith(expect.objectContaining({ route: 'unknown' }));
  });

  it('skips recording when metrics are disabled', () => {
    interceptor = new MetricsInterceptor(createMockMetricsService(false));
    const context = createMockExecutionContext();

    interceptor.intercept(context, createMockCallHandler()).subscribe();

    expect(mockCounter.inc).not.toHaveBeenCalled();
  });

  it('skips excluded routes (/health, /health/ready)', () => {
    for (const route of ['/health', '/health/ready']) {
      mockCounter.inc.mockClear();
      const context = createMockExecutionContext({ route });

      interceptor.intercept(context, createMockCallHandler()).subscribe();

      expect(mockCounter.inc).not.toHaveBeenCalled();
    }
  });

  it('records correct method and status code', async () => {
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(200);

    const context = createMockExecutionContext({ method: 'DELETE', statusCode: 204 });

    interceptor.intercept(context, createMockCallHandler()).subscribe();

    await vi.waitFor(() => expect(mockCounter.inc).toHaveBeenCalled());
    expect(mockCounter.inc).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'DELETE', status_code: '204' }),
    );
  });
});
