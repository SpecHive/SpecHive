interface WaitOptions {
  maxAttempts?: number;
  delayMs?: number;
}

/** Poll a service's /health endpoint until it responds OK. */
export async function waitForService(url: string, options?: WaitOptions): Promise<void> {
  const { maxAttempts = 20, delayMs = 500 } = options ?? {};
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // Service not yet ready
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Service at ${url} did not become ready within ${maxAttempts * delayMs}ms`);
}

interface PollOptions<T> {
  maxAttempts?: number;
  delayMs?: number;
  predicate?: (result: T) => boolean;
}

/** Generic poller — calls `fn` until `predicate` returns true (default: truthy). */
export async function poll<T>(fn: () => Promise<T>, options?: PollOptions<T>): Promise<T> {
  const { maxAttempts = 30, delayMs = 500, predicate = Boolean } = options ?? {};
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await fn();
    if (predicate(result)) return result;
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`poll() did not satisfy predicate after ${maxAttempts * delayMs}ms`);
}

/**
 * Poll a query function until it returns rows matching an optional predicate.
 * Designed for `postgres.js` tagged-template queries.
 */
export async function waitForRow<T extends Record<string, unknown>>(
  queryFn: () => Promise<T[]>,
  options?: WaitOptions & { predicate?: (row: T) => boolean },
): Promise<T> {
  const { maxAttempts = 30, delayMs = 500, predicate } = options ?? {};
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rows = await queryFn();
    if (rows.length > 0) {
      const match = predicate ? rows.find(predicate) : rows[0];
      if (match) return match;
    }
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`waitForRow() timed out after ${maxAttempts * delayMs}ms`);
}
