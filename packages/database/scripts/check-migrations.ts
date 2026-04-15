/// <reference types="node" />
import { checkMigrations } from '../src/check-migrations.js';

const result = checkMigrations();

if (result.ok) {
  process.stdout.write('✓ All migration files match journal entries.\n');
  process.exit(0);
}

if (result.orphaned.length > 0) {
  console.error('✗ Orphaned SQL files (not in _journal.json):');
  for (const f of result.orphaned) {
    console.error(`  - ${f}.sql`);
  }
}

if (result.missing.length > 0) {
  console.error('✗ Missing SQL files (in _journal.json but not on disk):');
  for (const f of result.missing) {
    console.error(`  - ${f}.sql`);
  }
}

process.exit(1);
