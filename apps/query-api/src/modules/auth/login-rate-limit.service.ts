import { Injectable, type OnModuleDestroy } from '@nestjs/common';

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = WINDOW_MS;

interface FailureRecord {
  count: number;
  firstAttemptAt: number;
}

/**
 * In-memory login rate limiting — effective for single-instance deployments only.
 * Resets on process restart and is per-process (bypassed with multiple replicas).
 * The gateway's global throttle provides baseline brute-force protection.
 *
 * TODO: Migrate to Redis-backed rate limiting for multi-replica deployments.
 */
@Injectable()
export class LoginRateLimitService implements OnModuleDestroy {
  private readonly failures = new Map<string, FailureRecord>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }

  isBlocked(email: string): boolean {
    const key = email.toLowerCase();
    const record = this.failures.get(key);
    if (!record) return false;

    if (Date.now() - record.firstAttemptAt > WINDOW_MS) {
      this.failures.delete(key);
      return false;
    }

    return record.count >= MAX_FAILED_ATTEMPTS;
  }

  recordFailure(email: string): void {
    const key = email.toLowerCase();
    const record = this.failures.get(key);
    const now = Date.now();

    if (!record || now - record.firstAttemptAt > WINDOW_MS) {
      this.failures.set(key, { count: 1, firstAttemptAt: now });
    } else {
      record.count++;
    }
  }

  recordSuccess(email: string): void {
    this.failures.delete(email.toLowerCase());
  }

  clearAll(): void {
    this.failures.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.failures) {
      if (now - record.firstAttemptAt > WINDOW_MS) {
        this.failures.delete(key);
      }
    }
  }
}
