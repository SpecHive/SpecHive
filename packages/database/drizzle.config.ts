import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url = process.env['DATABASE_URL'];
if (!url) throw new Error('DATABASE_URL is required for drizzle-kit');

export default defineConfig({
  schema: [
    './src/schema/_common.ts',
    './src/schema/tenant.ts',
    './src/schema/project.ts',
    './src/schema/execution.ts',
    './src/schema/relations.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  strict: true,
  dbCredentials: {
    url,
  },
});
