import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './dist/schema/_common.js',
    './dist/schema/tenant.js',
    './dist/schema/project.js',
    './dist/schema/execution.js',
    './dist/schema/relations.js',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
});
