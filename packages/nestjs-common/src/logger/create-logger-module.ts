import { type DynamicModule, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { Params } from 'nestjs-pino';

type PinoTransport = NonNullable<Extract<Params['pinoHttp'], { transport?: unknown }>['transport']>;

function buildTransport(): PinoTransport | undefined {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return { target: 'pino-pretty' };
  }

  const lokiHost = process.env.LOKI_HOST;
  const lokiUsername = process.env.LOKI_USERNAME;
  const lokiPassword = process.env.LOKI_PASSWORD;

  if (!lokiHost || !lokiUsername || !lokiPassword) {
    return undefined; // stdout only — no transport needed
  }

  return {
    targets: [
      { target: 'pino/file', options: { destination: 1 }, level: 'info' },
      {
        target: 'pino-loki',
        options: {
          batching: { interval: 5 },
          host: lokiHost,
          basicAuth: { username: lokiUsername, password: lokiPassword },
          labels: {
            app: process.env.LOKI_APP_LABEL || 'spechive',
            environment: 'production',
          },
        },
        level: 'info',
      },
    ],
  };
}

export function createLoggerModule(): DynamicModule {
  const isProduction = process.env.NODE_ENV === 'production';

  const transport = buildTransport();

  const params: Params = {
    pinoHttp: {
      level: isProduction ? 'info' : 'debug',
      ...(transport ? { transport } : {}),
    },
    exclude: [
      { method: RequestMethod.GET, path: 'health' },
      { method: RequestMethod.GET, path: 'health/ready' },
    ],
  };

  return LoggerModule.forRoot(params);
}
