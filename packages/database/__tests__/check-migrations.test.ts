import { describe, expect, it } from 'vitest';

import { validateMigrationIntegrity } from '../src/check-migrations.js';

describe('validateMigrationIntegrity', () => {
  it('passes when all SQL files have journal entries', () => {
    const result = validateMigrationIntegrity(
      ['0000_brainy_molten_man', '0001_vengeful_the_stranger'],
      ['0000_brainy_molten_man', '0001_vengeful_the_stranger'],
    );

    expect(result.ok).toBe(true);
    expect(result.orphaned).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('detects orphaned SQL files with no journal entry', () => {
    const result = validateMigrationIntegrity(['0000_foo', '0001_orphan'], ['0000_foo']);

    expect(result.ok).toBe(false);
    expect(result.orphaned).toEqual(['0001_orphan']);
    expect(result.missing).toEqual([]);
  });

  it('detects journal entries with no SQL file', () => {
    const result = validateMigrationIntegrity(['0000_foo'], ['0000_foo', '0001_missing']);

    expect(result.ok).toBe(false);
    expect(result.orphaned).toEqual([]);
    expect(result.missing).toEqual(['0001_missing']);
  });

  it('reports both orphaned and missing simultaneously', () => {
    const result = validateMigrationIntegrity(
      ['0000_foo', '0002_orphan'],
      ['0000_foo', '0001_missing'],
    );

    expect(result.ok).toBe(false);
    expect(result.orphaned).toEqual(['0002_orphan']);
    expect(result.missing).toEqual(['0001_missing']);
  });
});
