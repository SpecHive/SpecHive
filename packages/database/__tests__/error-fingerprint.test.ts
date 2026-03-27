import { describe, it, expect } from 'vitest';

import { normalizeErrorMessage, computeFingerprint } from '../src/lib/error-fingerprint.js';

describe('normalizeErrorMessage', () => {
  it('collapses UUIDs', () => {
    const msg = 'Failed for user 550e8400-e29b-41d4-a716-446655440000';
    expect(normalizeErrorMessage(msg)).toBe('Failed for user <UUID>');
  });

  it('collapses hex addresses', () => {
    const msg = 'Segfault at 0x7fff5fbff8a0';
    expect(normalizeErrorMessage(msg)).toBe('Segfault at <ADDR>');
  });

  it('collapses ISO timestamps', () => {
    const msg = 'Error at 2024-01-15T10:30:45.123Z in handler';
    expect(normalizeErrorMessage(msg)).toBe('Error at <TIMESTAMP> in handler');
  });

  it('collapses Unix epoch milliseconds', () => {
    const msg = 'Timeout at 1705312245123';
    expect(normalizeErrorMessage(msg)).toBe('Timeout at <TIMESTAMP>');
  });

  it('collapses file line:column positions', () => {
    const msg = 'Error in src/app.ts:42:15';
    expect(normalizeErrorMessage(msg)).toBe('Error in src/app.ts:<LINE>');
  });

  it('collapses large numbers (5+ digits)', () => {
    const msg = 'Timeout after 30000ms waiting for selector';
    expect(normalizeErrorMessage(msg)).toBe('Timeout after <NUM>ms waiting for selector');
  });

  it('does not collapse small numbers', () => {
    const msg = 'Expected 3 items but got 0';
    expect(normalizeErrorMessage(msg)).toBe('Expected 3 items but got 0');
  });

  it('collapses whitespace and trims', () => {
    const msg = '  Error   in\n  handler  ';
    expect(normalizeErrorMessage(msg)).toBe('Error in handler');
  });

  it('handles empty string', () => {
    expect(normalizeErrorMessage('')).toBe('');
  });

  it('handles multiple replacements in one message', () => {
    const msg =
      'User 550e8400-e29b-41d4-a716-446655440000 failed at 2024-01-15T10:30:45Z in file.ts:42:15';
    expect(normalizeErrorMessage(msg)).toBe('User <UUID> failed at <TIMESTAMP> in file.ts:<LINE>');
  });

  it('normalizes real Playwright timeout error', () => {
    const msg =
      'locator.click: Timeout 30000ms exceeded.\nCall log:\n  waiting for locator("#submit-btn")';
    expect(normalizeErrorMessage(msg)).toBe(
      'locator.click: Timeout <NUM>ms exceeded. Call log: waiting for locator("#submit-btn")',
    );
  });

  it('normalizes real Vitest assertion error', () => {
    const msg =
      'AssertionError: expected 550e8400-e29b-41d4-a716-446655440000 to equal 660e8400-e29b-41d4-a716-446655440001';
    expect(normalizeErrorMessage(msg)).toBe('AssertionError: expected <UUID> to equal <UUID>');
  });
});

describe('computeFingerprint', () => {
  it('returns a 64-character hex string', () => {
    const { fingerprint } = computeFingerprint('some error');
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input produces same output', () => {
    const a = computeFingerprint('Timeout after 30000ms');
    const b = computeFingerprint('Timeout after 30000ms');
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.normalizedMessage).toBe(b.normalizedMessage);
  });

  it('produces same fingerprint for variable-only differences', () => {
    const a = computeFingerprint('Timeout after 30000ms');
    const b = computeFingerprint('Timeout after 60000ms');
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('includes errorName in fingerprint when provided', () => {
    const withName = computeFingerprint('something failed', 'TimeoutError');
    const withoutName = computeFingerprint('something failed');
    expect(withName.fingerprint).not.toBe(withoutName.fingerprint);
  });

  it('different errorNames produce different fingerprints', () => {
    const a = computeFingerprint('something failed', 'TypeError');
    const b = computeFingerprint('something failed', 'ReferenceError');
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it('returns the normalized message alongside the fingerprint', () => {
    const { normalizedMessage } = computeFingerprint('Error at 2024-01-15T10:30:45Z');
    expect(normalizedMessage).toBe('Error at <TIMESTAMP>');
  });
});
