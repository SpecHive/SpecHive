import 'reflect-metadata';
import { bootstrapNestApp } from '@spechive/nestjs-common';

import { AppModule } from './app.module';

bootstrapNestApp({
  module: AppModule,
  cors: true,
  cookies: true,
}).catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
