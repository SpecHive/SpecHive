import 'reflect-metadata';
import { bootstrapNestApp } from '@assertly/nestjs-common';

import { AppModule } from './app.module';

bootstrapNestApp({
  module: AppModule,
  bodyLimit: 15_000_000,
  cors: true,
}).catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
