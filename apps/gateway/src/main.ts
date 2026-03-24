import 'reflect-metadata';

import replyFrom from '@fastify/reply-from';
import { bootstrapNestApp } from '@spechive/nestjs-common';

import { AppModule } from './app.module';

bootstrapNestApp({
  module: AppModule,
  bodyLimit: 15_000_000,
  cors: true,
  fastifyPlugins: async (app) => {
    // @fastify/reply-from powers the reverse proxy; undici pool for upstream connections.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(replyFrom as any, { undici: { connections: 50 } });
  },
}).catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
