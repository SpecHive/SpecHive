import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Parse a .env file into a key-value record.
 * Skips empty lines and comments. Does not handle quoting.
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
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
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
