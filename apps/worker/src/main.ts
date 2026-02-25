import 'reflect-metadata';
import { AllExceptionsFilter } from '@assertly/nestjs-common';
import helmet from '@fastify/helmet';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { type EnvConfig } from './modules/config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  await app.register(helmet);

  const config = app.get(ConfigService<EnvConfig>);
  const port = config.getOrThrow<number>('PORT');

  app.useGlobalFilters(new AllExceptionsFilter(config));

  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
