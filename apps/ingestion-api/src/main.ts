import 'reflect-metadata';
import { bootstrapNestApp } from '@spechive/nestjs-common';

import { AppModule } from './app.module';

bootstrapNestApp({
  module: AppModule,
  bodyLimit: 15_000_000,
}).catch((err) => {
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
