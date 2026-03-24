import helmet from '@fastify/helmet';
import type { Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';

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
    options.rawBody ? { rawBody: true } : {},
  );
  app.enableShutdownHooks();

  // Type casts needed: @fastify/cookie augments FastifyInstance which creates
  // type incompatibility with other Fastify plugins. This is a known Fastify issue.
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

  app.useGlobalFilters(new AllExceptionsFilter(config as ConfigService<BaseEnvConfig>));

  await app.listen(port, '0.0.0.0');
}
