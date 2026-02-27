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
}

export async function bootstrapNestApp(options: BootstrapOptions): Promise<void> {
  const adapterOpts: Record<string, unknown> = { trustProxy: true };
  if (options.bodyLimit !== undefined) adapterOpts.bodyLimit = options.bodyLimit;
  const app = await NestFactory.create<NestFastifyApplication>(
    options.module,
    new FastifyAdapter(adapterOpts),
  );
  app.enableShutdownHooks();

  await app.register(helmet);

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');

  if (options.cors) {
    const corsOrigin = config.getOrThrow<string>('CORS_ORIGIN');
    app.enableCors({ origin: corsOrigin });
  }

  app.useGlobalFilters(new AllExceptionsFilter(config as ConfigService<BaseEnvConfig>));

  await app.listen(port, '0.0.0.0');
}
