/// <reference types="node" />

import 'dotenv/config';

import { backfillDailyStats } from '../src/backfill-daily-stats.js';

const url = process.env['SEED_DATABASE_URL'];
if (!url) {
  console.error(
    'SEED_DATABASE_URL is required. This script must run as the superuser role to bypass RLS.',
  );
  process.exit(1);
}

backfillDailyStats(url).catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
