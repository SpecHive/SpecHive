/** Extract PostgreSQL error from either a direct or Drizzle-wrapped error. */
export function extractPgError(err: unknown): { code: string; detail: string | undefined } | null {
  if (err instanceof Error && 'code' in err) {
    return { code: (err as { code: string }).code, detail: (err as { detail?: string }).detail };
  }
  if (err instanceof Error && err.cause instanceof Error && 'code' in err.cause) {
    return {
      code: (err.cause as { code: string }).code,
      detail: (err.cause as { detail?: string }).detail,
    };
  }
  return null;
}
