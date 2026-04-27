import { RequestMethod } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('nestjs-pino', () => ({
  LoggerModule: { forRootAsync: vi.fn((opts: unknown) => ({ opts })) },
}));

vi.mock('../src/logger/pino-pretty-available', () => ({
  isPinoPrettyAvailable: vi.fn(() => true),
}));

import { createLoggerModule } from '../src/logger/create-logger-module';
import { isPinoPrettyAvailable } from '../src/logger/pino-pretty-available';

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: vi.fn((key: string) => env[key]),
  } as unknown as ConfigService;
}

type Factory = (config: ConfigService) => {
  pinoHttp: Record<string, unknown>;
  exclude: unknown[];
};

function extractParams(result: unknown, env: Record<string, string | undefined>) {
  const { opts } = result as { opts: { useFactory: Factory } };
  return opts.useFactory(createMockConfig(env));
}

describe('createLoggerModule', () => {
  it('uses pino-pretty transport in development when available', () => {
    vi.mocked(isPinoPrettyAvailable).mockReturnValue(true);

    const params = extractParams(createLoggerModule(), { NODE_ENV: 'development' });

    expect(params.pinoHttp.level).toBe('debug');
    expect(params.pinoHttp.transport).toEqual({ target: 'pino-pretty' });
  });

  it('falls back to JSON output when pino-pretty is not installed', () => {
    vi.mocked(isPinoPrettyAvailable).mockReturnValue(false);

    const params = extractParams(createLoggerModule(), { NODE_ENV: 'development' });

    expect(params.pinoHttp.level).toBe('debug');
    expect(params.pinoHttp.transport).toBeUndefined();
  });

  it('uses stdout-only in production without Loki', () => {
    const params = extractParams(createLoggerModule(), { NODE_ENV: 'production' });

    expect(params.pinoHttp.level).toBe('info');

    const targets = (params.pinoHttp.transport as { targets: { target: string }[] }).targets;
    expect(targets).toHaveLength(1);
    expect(targets[0]!.target).toBe('pino/file');
  });

  it('configures Loki transport in production when LOKI_HOST is set', () => {
    const params = extractParams(createLoggerModule(), {
      NODE_ENV: 'production',
      LOKI_HOST: 'http://loki:3100',
    });

    expect(params.pinoHttp.level).toBe('info');
    expect(params.pinoHttp.transport).toBeDefined();

    const targets = (params.pinoHttp.transport as { targets: { target: string }[] }).targets;
    expect(targets).toHaveLength(2);
    expect(targets[0]!.target).toBe('pino/file');
    expect(targets[1]!.target).toBe('pino-loki');
  });

  it('includes both pino-pretty and Loki in dev when LOKI_HOST is set', () => {
    vi.mocked(isPinoPrettyAvailable).mockReturnValue(true);

    const params = extractParams(createLoggerModule(), {
      NODE_ENV: 'development',
      LOKI_HOST: 'http://loki:3100',
    });

    const targets = (params.pinoHttp.transport as { targets: { target: string }[] }).targets;
    expect(targets).toHaveLength(2);
    expect(targets.map((t) => t.target)).toEqual(['pino-loki', 'pino-pretty']);
  });

  it('sets environment label to development in dev mode', () => {
    vi.mocked(isPinoPrettyAvailable).mockReturnValue(true);

    const params = extractParams(createLoggerModule(), {
      NODE_ENV: 'development',
      LOKI_HOST: 'http://loki:3100',
    });

    const targets = (
      params.pinoHttp.transport as {
        targets: { target: string; options: { labels: { environment: string } } }[];
      }
    ).targets;
    const lokiTarget = targets.find((t) => t.target === 'pino-loki')!;
    expect(lokiTarget.options.labels.environment).toBe('development');
  });

  it('sanitizes hyphens in SERVICE_NAME for Loki app label (matches Prometheus service label)', () => {
    const params = extractParams(createLoggerModule(), {
      NODE_ENV: 'production',
      LOKI_HOST: 'http://loki:3100',
      SERVICE_NAME: 'my-custom-app',
    });

    const targets = (
      params.pinoHttp.transport as {
        targets: { target: string; options: { labels: { app: string } } }[];
      }
    ).targets;
    const lokiTarget = targets.find((t) => t.target === 'pino-loki')!;
    expect(lokiTarget.options.labels.app).toBe('my_custom_app');
  });

  it('defaults Loki app label to "spechive" when SERVICE_NAME is missing', () => {
    const params = extractParams(createLoggerModule(), {
      NODE_ENV: 'production',
      LOKI_HOST: 'http://loki:3100',
    });

    const targets = (
      params.pinoHttp.transport as {
        targets: { target: string; options: { labels: { app: string } } }[];
      }
    ).targets;
    const lokiTarget = targets.find((t) => t.target === 'pino-loki')!;
    expect(lokiTarget.options.labels.app).toBe('spechive');
  });

  it('excludes internal routes from request logging', () => {
    const params = extractParams(createLoggerModule(), { NODE_ENV: 'production' });

    expect(params.exclude).toEqual([
      { method: RequestMethod.GET, path: 'health' },
      { method: RequestMethod.GET, path: 'health/ready' },
      { method: RequestMethod.GET, path: 'v1/sse/events' },
    ]);
  });
});
