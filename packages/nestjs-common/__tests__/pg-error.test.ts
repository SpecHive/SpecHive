import { describe, it, expect } from 'vitest';

import {
  DEFAULT_RETRYABLE_PG_CODES,
  extractPgError,
  isRetryablePgError,
} from '../src/utils/pg-error';

function makePgError(code: string, detail?: string): Error {
  return Object.assign(new Error(`PG ${code}`), { code, detail });
}

function makeDrizzleWrapped(code: string): Error {
  const err = new Error('DrizzleError');
  (err as Error & { cause: Error }).cause = makePgError(code);
  return err;
}

describe('extractPgError', () => {
  it('extracts code and detail from a direct PG error', () => {
    const err = makePgError('23503', 'Key (suite_id)=(abc) is not present');
    expect(extractPgError(err)).toEqual({
      code: '23503',
      detail: 'Key (suite_id)=(abc) is not present',
    });
  });

  it('extracts from Drizzle-wrapped error via cause chain', () => {
    const err = makeDrizzleWrapped('23503');
    expect(extractPgError(err)).toEqual({ code: '23503', detail: undefined });
  });

  it('returns null for plain Error without code', () => {
    expect(extractPgError(new Error('no code'))).toBeNull();
  });

  it.each([['string'], [null], [42], [undefined]])(
    'returns null for non-Error value: %s',
    (value) => {
      expect(extractPgError(value)).toBeNull();
    },
  );
});

describe('isRetryablePgError', () => {
  it('returns true for direct 23503 error', () => {
    expect(isRetryablePgError(makePgError('23503'))).toBe(true);
  });

  it('returns true for Drizzle-wrapped 23503 error', () => {
    expect(isRetryablePgError(makeDrizzleWrapped('23503'))).toBe(true);
  });

  it('returns false for non-retryable PG code', () => {
    expect(isRetryablePgError(makePgError('42P01'))).toBe(false);
  });

  it('returns false for plain Error without code', () => {
    expect(isRetryablePgError(new Error('no code'))).toBe(false);
  });

  it('accepts a custom retryable code set', () => {
    const custom = new Set(['40001']);
    expect(isRetryablePgError(makePgError('40001'), custom)).toBe(true);
  });

  it('does not match default codes when custom set is provided', () => {
    const custom = new Set(['40001']);
    expect(isRetryablePgError(makePgError('23503'), custom)).toBe(false);
  });
});

describe('DEFAULT_RETRYABLE_PG_CODES', () => {
  it('contains only 23503', () => {
    expect(DEFAULT_RETRYABLE_PG_CODES).toEqual(new Set(['23503']));
  });
});
