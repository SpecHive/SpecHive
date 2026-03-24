const EXPIRY_PATTERN = /^(\d+)([smhd])$/;

const MULTIPLIERS_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const MULTIPLIERS_SEC: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/** Parse an expiry string (e.g., "7d", "15m") and return a Date that far in the future. */
export function parseExpiry(str: string): Date {
  const match = str.match(EXPIRY_PATTERN);
  if (!match) throw new Error(`Invalid expiry format: ${str}`);
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  return new Date(Date.now() + value * MULTIPLIERS_MS[unit]!);
}

/** Parse an expiry string (e.g., "7d", "15m") and return the duration in seconds. */
export function parseExpirySeconds(str: string): number {
  const match = str.match(EXPIRY_PATTERN);
  if (!match) throw new Error(`Invalid expiry format: ${str}`);
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  return value * MULTIPLIERS_SEC[unit]!;
}
