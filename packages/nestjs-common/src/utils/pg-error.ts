/** Structured PostgreSQL error info extracted from an error chain. */
export interface PgErrorInfo {
  code: string;
  detail: string | undefined;
  constraint: string | undefined;
  table: string | undefined;
}

/** Extract PostgreSQL error from anywhere in the error cause chain. */
export function extractPgError(err: unknown): PgErrorInfo | null {
  let current = err;
  while (current instanceof Error) {
    const rawCode = 'code' in current ? (current as { code: unknown }).code : undefined;
    if (typeof rawCode === 'string' && /^[0-9A-Z]{5}$/.test(rawCode)) {
      return {
        code: rawCode,
        detail: (current as { detail?: string }).detail,
        constraint: (current as { constraint?: string }).constraint,
        table: (current as { table?: string }).table,
      };
    }
    current = current.cause;
  }
  return null;
}

/**
 * PG error codes commonly retryable in event-driven architectures.
 * - 23503: foreign_key_violation — referenced entity not committed yet (cross-batch ordering)
 *
 * P0001 (raise_exception) deliberately excluded — too broad, matches both transient
 * and permanent trigger failures. Handle specific P0001 cases at the handler level.
 * Services can extend: new Set([...DEFAULT_RETRYABLE_PG_CODES, '40001'])
 */
export const DEFAULT_RETRYABLE_PG_CODES: ReadonlySet<string> = new Set(['23503']);
