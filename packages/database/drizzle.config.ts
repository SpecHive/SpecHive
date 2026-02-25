import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/schema/_common.ts',
    './src/schema/tenant.ts',
    './src/schema/project.ts',
    './src/schema/execution.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
});
