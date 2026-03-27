import { createHash } from 'node:crypto';

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

/**
 * Computes a stable fingerprint for an error message. Errors with the same
 * normalized message (and optional error name) produce the same fingerprint,
 * enabling grouping of recurring errors.
 */
export function computeFingerprint(
  errorMessage: string,
  errorName?: string,
): { fingerprint: string; normalizedMessage: string } {
  const normalizedMessage = normalizeErrorMessage(errorMessage);
  const input = errorName ? `${errorName}::${normalizedMessage}` : normalizedMessage;
  const fingerprint = createHash('sha256').update(input).digest('hex');
  return { fingerprint, normalizedMessage };
}
