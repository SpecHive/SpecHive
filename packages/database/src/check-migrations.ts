import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Journal {
  entries: { tag: string }[];
}

export interface MigrationCheckResult {
  ok: boolean;
  orphaned: string[];
  missing: string[];
}

/** Compare SQL files on disk against the Drizzle journal entries. */
export function validateMigrationIntegrity(
  sqlFiles: string[],
  journalTags: string[],
): MigrationCheckResult {
  const tagSet = new Set(journalTags);
  const fileSet = new Set(sqlFiles);

  const orphaned = sqlFiles.filter((f) => !tagSet.has(f));
  const missing = journalTags.filter((t) => !fileSet.has(t));

  return { ok: orphaned.length === 0 && missing.length === 0, orphaned, missing };
}

/** Read real files and journal, then validate. */
export function checkMigrations(drizzleDir?: string): MigrationCheckResult {
  const dir = drizzleDir ?? resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');

  const sqlFiles = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace('.sql', ''));

  const journalPath = resolve(dir, 'meta/_journal.json');
  const journal: Journal = JSON.parse(readFileSync(journalPath, 'utf-8'));
  const journalTags = journal.entries.map((e) => e.tag);

  return validateMigrationIntegrity(sqlFiles, journalTags);
}
