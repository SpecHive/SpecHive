import helmet from '@fastify/helmet';
import type { Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Logger, LoggerErrorInterceptor, PinoLogger } from 'nestjs-pino';

import type { BaseEnvConfig } from '../config/base-env.schema';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';

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
  app.enableShutdownHooks();

  await app.register(helmet);

  if (options.fastifyPlugins) {
    await options.fastifyPlugins(app);
  }

  if (options.cookies) {
    const cookie = await import('@fastify/cookie');
    await app.register(cookie.default);
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

  await app.listen(port, '0.0.0.0');
}
