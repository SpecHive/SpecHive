import { describe, it, expect } from 'vitest';

import { extractPgError } from '../src/utils/pg-error';

function makePgError(code: string, detail?: string, constraint?: string, table?: string): Error {
  return Object.assign(new Error(`PG ${code}`), { code, detail, constraint, table });
}

function makeDrizzleWrapped(code: string): Error {
  const err = new Error('DrizzleError');
  (err as Error & { cause: Error }).cause = makePgError(code);
  return err;
}

describe('extractPgError', () => {
  it('extracts code, detail, constraint, and table from a direct PG error', () => {
    const err = makePgError('23503', 'Key (suite_id)=(abc) is not present', 'fk_suite_id', 'tests');
    expect(extractPgError(err)).toEqual({
      code: '23503',
      detail: 'Key (suite_id)=(abc) is not present',
      constraint: 'fk_suite_id',
      table: 'tests',
    });
  });

  it('extracts from Drizzle-wrapped error via cause chain', () => {
    const err = makeDrizzleWrapped('23503');
    expect(extractPgError(err)).toEqual({
      code: '23503',
      detail: undefined,
      constraint: undefined,
      table: undefined,
    });
  });

  it('extracts from a 3-level cause chain', () => {
    const dbError = makePgError('23505', 'duplicate key', 'uq_name', 'projects');
    const drizzleError = new Error('DrizzleQueryError');
    (drizzleError as Error & { cause: Error }).cause = dbError;
    const retryableError = new Error('RetryableError');
    (retryableError as Error & { cause: Error }).cause = drizzleError;

    expect(extractPgError(retryableError)).toEqual({
      code: '23505',
      detail: 'duplicate key',
      constraint: 'uq_name',
      table: 'projects',
    });
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

  it('returns null for Node.js SystemError (ECONNREFUSED)', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    expect(extractPgError(err)).toBeNull();
  });

  it('returns null for Node.js SystemError (ENOTFOUND)', () => {
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
    expect(extractPgError(err)).toBeNull();
  });

  it('skips SystemError in cause chain and extracts PG error', () => {
    const pgError = makePgError('23503', 'FK violation', 'fk_run_id', 'suites');
    const sysError = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    (sysError as unknown as Error & { cause: Error }).cause = pgError;
    const wrapper = new Error('connection failed');
    (wrapper as Error & { cause: Error }).cause = sysError;

    expect(extractPgError(wrapper)).toEqual({
      code: '23503',
      detail: 'FK violation',
      constraint: 'fk_run_id',
      table: 'suites',
    });
  });
});
