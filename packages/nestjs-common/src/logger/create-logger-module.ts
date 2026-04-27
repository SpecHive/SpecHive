import { type DynamicModule, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Params } from 'nestjs-pino';

import { INTERNAL_ROUTE_PATHS } from '../constants';
import { sanitizeServiceName } from '../utils/sanitize-service-name';

import { isPinoPrettyAvailable } from './pino-pretty-available';

type PinoTransport = NonNullable<Extract<Params['pinoHttp'], { transport?: unknown }>['transport']>;

interface TransportTarget {
  target: string;
  options?: Record<string, unknown>;
  level?: string;
}

function buildTransport(
  isProduction: boolean,
  lokiHost?: string,
  serviceName?: string,
): PinoTransport | undefined {
  const targets: TransportTarget[] = [];

  // stdout in production (dev uses pino-pretty below)
  if (isProduction) {
    targets.push({ target: 'pino/file', options: { destination: 1 }, level: 'info' });
  }

  if (lokiHost) {
    // Must match the Prometheus `service` label for cross-linking in Grafana.
    const appLabel = sanitizeServiceName(serviceName);
    targets.push({
      target: 'pino-loki',
      options: {
        batching: { interval: 5 }, // seconds
        host: lokiHost,
        labels: {
          app: appLabel,
          environment: isProduction ? 'production' : 'development',
        },
      },
      level: 'info',
    });
  }

  // pino-pretty for dev console output
  if (!isProduction && isPinoPrettyAvailable()) {
    targets.push({ target: 'pino-pretty', level: 'debug' });
  }

  if (targets.length === 0) return undefined;

  // Single pino-pretty — return simple transport (matches original behavior)
  if (targets.length === 1 && targets[0].target === 'pino-pretty') {
    return { target: 'pino-pretty' };
  }

  return { targets };
}

export function createLoggerModule(): DynamicModule {
  return LoggerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const isProduction = config.get<string>('NODE_ENV') === 'production';
      const lokiHost = config.get<string>('LOKI_HOST');
      const serviceName = config.get<string>('SERVICE_NAME');

      const transport = buildTransport(isProduction, lokiHost, serviceName);

      if (lokiHost) {
        // eslint-disable-next-line no-console -- pino isn't initialized yet
        console.log(`[logger] Loki transport active → ${lokiHost}`);
      }

      return {
        pinoHttp: {
          level: isProduction ? 'info' : 'debug',
          ...(transport ? { transport } : {}),
        },
        exclude: INTERNAL_ROUTE_PATHS.map((p) => ({
          method: RequestMethod.GET,
          path: p.replace(/^\//, ''),
        })),
      } satisfies Params;
    },
  });
}
