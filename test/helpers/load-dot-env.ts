import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Strip inline comments and optional quotes from a raw .env value. */
function stripValue(raw: string): string {
  for (const q of ['"', "'"]) {
    if (raw.startsWith(q)) {
      const close = raw.indexOf(q, 1);
      return close === -1 ? raw.slice(1) : raw.slice(1, close);
    }
  }
  // Unquoted: strip inline comment (space + #) and trailing whitespace
  const commentIdx = raw.indexOf(' #');
  return (commentIdx === -1 ? raw : raw.slice(0, commentIdx)).trimEnd();
}

/**
 * Parse a .env file into a key-value record.
 * Skips empty lines and full-line comments. Strips inline comments
 * (` #` on unquoted values). Handles single/double-quoted values.
 */
export function parseDotEnv(path?: string): Record<string, string> {
  try {
    const content = readFileSync(path ?? resolve(process.cwd(), '.env'), 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      env[trimmed.slice(0, eqIdx)] = stripValue(trimmed.slice(eqIdx + 1));
    }
    return env;
  } catch {
    return {};
  }
}

/**
 * Merge .env values into process.env, skipping keys already set.
 * Intended for globalSetup which runs outside the Vitest env.
 */
export function loadDotEnvIntoProcess(path?: string): void {
  const env = parseDotEnv(path);
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
