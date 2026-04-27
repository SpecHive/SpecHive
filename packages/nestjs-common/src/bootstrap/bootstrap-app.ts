import type { Server } from 'node:http';

import helmet from '@fastify/helmet';
import type { Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Logger, LoggerErrorInterceptor, PinoLogger } from 'nestjs-pino';

import type { BaseEnvConfig } from '../config/base-env.schema';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { startMetricsServer } from '../metrics/metrics-server';
import { METRICS_PORT, METRICS_SERVICE } from '../metrics/metrics.constants';
import type { MetricsService } from '../metrics/metrics.service';

export interface BootstrapOptions {
  module: Type;
  bodyLimit?: number;
  cors?: boolean;
  cookies?: boolean;
  rawBody?: boolean;
  fastifyPlugins?: (app: NestFastifyApplication) => Promise<void>;
}

export async function bootstrapNestApp(options: BootstrapOptions): Promise<void> {
  const adapterOpts: Record<string, unknown> = { trustProxy: true };
  if (options.bodyLimit !== undefined) adapterOpts.bodyLimit = options.bodyLimit;
  const app = await NestFactory.create<NestFastifyApplication>(
    options.module,
    new FastifyAdapter(adapterOpts),
    { ...(options.rawBody ? { rawBody: true } : {}), bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  let metricsServer: Server | null = null;

  // enableShutdownHooks() uses process.kill(process.pid, signal) which prevents
  // pino from flushing logs. Custom handler uses process.exit(0) instead.
  // Ref: https://github.com/nestjs/nest/issues/15978
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    if (metricsServer) {
      await new Promise<void>((resolve) => metricsServer!.close(() => resolve()));
    }

    await app.close();

    // Flush pino transport worker thread (drains batched logs to Loki)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5_000); // 5s max flush
      PinoLogger.root.flush(() => {
        clearTimeout(timer);
        resolve();
      });
    });

    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  // Fastify plugin types lag behind @nestjs/platform-fastify — safe cast
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(helmet as any);

  if (options.fastifyPlugins) {
    await options.fastifyPlugins(app);
  }

  if (options.cookies) {
    const cookie = await import('@fastify/cookie');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(cookie.default as any);
  }

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  if (options.cors) {
    const corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');
    app.enableCors({
      origin: corsOrigin,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
      credentials: true,
    });
  }

  const filterLogger = await app.resolve(PinoLogger);
  filterLogger.setContext(AllExceptionsFilter.name);
  app.useGlobalFilters(
    new AllExceptionsFilter(config as ConfigService<BaseEnvConfig>, filterLogger),
  );

  const metrics = app.get<MetricsService>(METRICS_SERVICE);
  if (metrics.enabled) {
    const metricsLogger = await app.resolve(PinoLogger);
    metricsLogger.setContext('MetricsServer');
    const bindAddress = config.get<string>('METRICS_BIND_ADDR') ?? '0.0.0.0';
    metricsServer = await startMetricsServer(metrics, METRICS_PORT, metricsLogger, bindAddress);
  }

  await app.listen(port, '0.0.0.0');
}
