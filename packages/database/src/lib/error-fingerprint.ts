import { createHash } from 'node:crypto';

/**
 * Structured error fields sent by framework-aware reporters.
 * When present, these produce better fingerprints and titles than raw message parsing.
 */
export interface ErrorFields {
  errorCategory?: string | undefined;
  errorMatcher?: string | undefined;
  errorTarget?: string | undefined;
  errorExpected?: string | undefined;
}

/**
 * Normalizes an error message by replacing variable content (UUIDs, timestamps,
 * file positions, etc.) with placeholders so that structurally identical errors
 * produce the same fingerprint.
 */
export function normalizeErrorMessage(message: string): string {
  return (
    message
      // 1. Collapse UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      // 2. Collapse hex addresses (0x followed by 6+ hex digits)
      .replace(/0x[0-9a-fA-F]{6,}/g, '<ADDR>')
      // 3. Collapse ISO timestamps
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s)}\]]*/g, '<TIMESTAMP>')
      // 4. Collapse Unix epoch ms (13-digit numbers)
      .replace(/\b\d{13}\b/g, '<TIMESTAMP>')
      // 5. Collapse file line:column
      .replace(/:\d+:\d+/g, ':<LINE>')
      // 6. Collapse large numbers (5+ digits, not adjacent to other digits)
      .replace(/(?<!\d)\d{5,}(?!\d)/g, '<NUM>')
      // 7. Trim and collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Extracts the first non-empty line from a message. */
function firstLine(message: string): string {
  for (const line of message.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return message.trim();
}

const MAX_TITLE_LENGTH = 150;

/** Simplifies a locator string for display in titles. */
function simplifyLocator(locator: string): string {
  // locator('h1') → h1
  const simpleMatch = locator.match(/^locator\(['"]([^'"]+)['"]\)$/);
  if (simpleMatch) return simpleMatch[1];

  // getByRole('button', { name: /Signing in/ }) → button "Signing in"
  const roleMatch = locator.match(
    /^getByRole\(['"](\w+)['"](?:,\s*\{\s*name:\s*(?:\/([^/]+)\/|['"]([^'"]+)['"])\s*\})?\)$/,
  );
  if (roleMatch) {
    const role = roleMatch[1];
    const name = roleMatch[2] ?? roleMatch[3];
    return name ? `${role} "${name}"` : role;
  }

  // getByText('...') → text "..."
  const textMatch = locator.match(/^getBy(\w+)\(['"]([^'"]+)['"]\)$/);
  if (textMatch) return `${textMatch[1].toLowerCase()} "${textMatch[2]}"`;

  // Truncate complex locators
  return locator.length > 60 ? locator.slice(0, 57) + '...' : locator;
}

/** Generates a concise title from structured error fields. */
function generateStructuredTitle(fields: ErrorFields): string {
  const target = fields.errorTarget ? simplifyLocator(fields.errorTarget) : undefined;

  switch (fields.errorCategory) {
    case 'assertion': {
      let title = `${fields.errorMatcher ?? 'assertion'} failed`;
      if (target) title += `: ${target}`;
      if (fields.errorExpected) title += ` expected ${fields.errorExpected}`;
      return title.slice(0, MAX_TITLE_LENGTH);
    }
    case 'timeout': {
      let title = `Timeout: ${fields.errorMatcher ?? 'unknown'}`;
      if (target) title += ` on ${target}`;
      return title.slice(0, MAX_TITLE_LENGTH);
    }
    case 'action': {
      let title = `${fields.errorMatcher ?? 'action'} failed`;
      if (target) title += `: ${target}`;
      return title.slice(0, MAX_TITLE_LENGTH);
    }
    default:
      return '';
  }
}

/**
 * Builds the signature string used as fingerprint input.
 * With structured fields: uses category + matcher + target + expected (excludes actual/received).
 * Without: uses just the first line of the normalized message.
 */
function buildSignature(
  message: string,
  errorName: string | undefined,
  fields: ErrorFields | undefined,
): string {
  const hasStructured = fields?.errorCategory && fields?.errorMatcher;

  if (hasStructured) {
    const parts = [
      fields.errorCategory,
      fields.errorMatcher,
      fields.errorTarget ?? '',
      fields.errorExpected ?? '',
    ];
    const signature = parts.join('::');
    return errorName ? `${errorName}::${signature}` : signature;
  }

  // Fallback: normalize the first line of the raw message
  const normalizedFirstLine = normalizeErrorMessage(firstLine(message));
  return errorName ? `${errorName}::${normalizedFirstLine}` : normalizedFirstLine;
}

/**
 * Computes a stable fingerprint for an error message. Errors with the same
 * structural signature produce the same fingerprint, enabling grouping of recurring errors.
 *
 * When structured fields are provided (from framework-aware reporters), the fingerprint
 * is based on the error's structural identity (category + matcher + target + expected),
 * excluding variable parts like received values and call logs.
 *
 * Without structured fields, falls back to hashing the first line of the normalized message.
 */
export function computeFingerprint(
  errorMessage: string,
  errorName?: string,
  fields?: ErrorFields,
): { fingerprint: string; normalizedMessage: string; title: string } {
  const normalizedMessage = normalizeErrorMessage(errorMessage);
  const signature = buildSignature(errorMessage, errorName, fields);
  const fingerprint = createHash('sha256').update(signature).digest('hex');

  // Title: use structured fields if available, otherwise first line
  const structuredTitle = fields?.errorCategory ? generateStructuredTitle(fields) : '';
  const title = structuredTitle || firstLine(errorMessage).slice(0, MAX_TITLE_LENGTH);

  return { fingerprint, normalizedMessage, title };
}
