import { RequestMethod } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('nestjs-pino', () => ({
  LoggerModule: { forRoot: vi.fn((params: unknown) => ({ params })) },
}));

vi.mock('../src/logger/pino-pretty-available', () => ({
  isPinoPrettyAvailable: vi.fn(() => true),
}));

import { createLoggerModule } from '../src/logger/create-logger-module';
import { isPinoPrettyAvailable } from '../src/logger/pino-pretty-available';

const ENV_BACKUP = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_BACKUP };
  vi.restoreAllMocks();
});

function extractParams(result: unknown) {
  return (result as { params: { pinoHttp: Record<string, unknown>; exclude: unknown[] } }).params;
}

describe('createLoggerModule', () => {
  it('uses pino-pretty transport in development when available', () => {
    process.env.NODE_ENV = 'development';
    vi.mocked(isPinoPrettyAvailable).mockReturnValue(true);

    const params = extractParams(createLoggerModule());

    expect(params.pinoHttp.level).toBe('debug');
    expect(params.pinoHttp.transport).toEqual({ target: 'pino-pretty' });
  });

  it('falls back to JSON output when pino-pretty is not installed', () => {
    process.env.NODE_ENV = 'development';
    vi.mocked(isPinoPrettyAvailable).mockReturnValue(false);

    const params = extractParams(createLoggerModule());

    expect(params.pinoHttp.level).toBe('debug');
    expect(params.pinoHttp.transport).toBeUndefined();
  });

  it('uses stdout-only in production without Loki config', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOKI_HOST;
    delete process.env.LOKI_USERNAME;
    delete process.env.LOKI_PASSWORD;

    const params = extractParams(createLoggerModule());

    expect(params.pinoHttp.level).toBe('info');
    expect(params.pinoHttp.transport).toBeUndefined();
  });

  it('configures Loki transport in production when credentials are set', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOKI_HOST = 'https://logs.example.com';
    process.env.LOKI_USERNAME = '12345';
    process.env.LOKI_PASSWORD = 'secret';

    const params = extractParams(createLoggerModule());

    expect(params.pinoHttp.level).toBe('info');
    expect(params.pinoHttp.transport).toBeDefined();

    const targets = (params.pinoHttp.transport as { targets: { target: string }[] }).targets;
    expect(targets).toHaveLength(2);
    expect(targets[0]!.target).toBe('pino/file');
    expect(targets[1]!.target).toBe('pino-loki');
  });

  it('uses custom LOKI_APP_LABEL when provided', () => {
    process.env.NODE_ENV = 'production';
    process.env.LOKI_HOST = 'https://logs.example.com';
    process.env.LOKI_USERNAME = '12345';
    process.env.LOKI_PASSWORD = 'secret';
    process.env.LOKI_APP_LABEL = 'my-custom-app';

    const params = extractParams(createLoggerModule());

    const targets = (
      params.pinoHttp.transport as {
        targets: { target: string; options: { labels: { app: string } } }[];
      }
    ).targets;
    expect(targets[1]!.options.labels.app).toBe('my-custom-app');
  });

  it('excludes health check routes', () => {
    process.env.NODE_ENV = 'production';

    const params = extractParams(createLoggerModule());

    expect(params.exclude).toEqual([
      { method: RequestMethod.GET, path: 'health' },
      { method: RequestMethod.GET, path: 'health/ready' },
    ]);
  });
});
