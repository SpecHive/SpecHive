export function extractPgError(err: unknown): { code: string; detail: string | undefined } | null {
  if (
    err instanceof Error &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  ) {
    return { code: (err as { code: string }).code, detail: (err as { detail?: string }).detail };
  }
  if (
    err instanceof Error &&
    err.cause instanceof Error &&
    'code' in err.cause &&
    typeof (err.cause as { code: unknown }).code === 'string'
  ) {
    return {
      code: (err.cause as { code: string }).code,
      detail: (err.cause as { detail?: string }).detail,
    };
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

export function isRetryablePgError(
  err: unknown,
  retryableCodes: ReadonlySet<string> = DEFAULT_RETRYABLE_PG_CODES,
): boolean {
  const pgErr = extractPgError(err);
  return pgErr !== null && retryableCodes.has(pgErr.code);
}
