import { describe, it, expect } from 'vitest';

import { parseErrorName } from '../src/index.js';

describe('parseErrorName', () => {
  describe('standard JS/Node error names', () => {
    it.each([
      ['AssertionError: expected true to be false', 'AssertionError'],
      ['TypeError: Cannot read properties of undefined', 'TypeError'],
      ['RangeError: Maximum call stack size exceeded', 'RangeError'],
      ['ReferenceError: foo is not defined', 'ReferenceError'],
      ['Error: something went wrong', 'Error'],
      ['CustomError: custom message', 'CustomError'],
      ['SomeError:no space after colon', 'SomeError'],
    ])('%s → %s', (input, expected) => {
      expect(parseErrorName(input)).toBe(expected);
    });
  });

  describe('Playwright-style errors (not matched)', () => {
    it.each([
      ['locator.click: Timeout 30000ms exceeded'],
      ['expect(received).toBe(expected)'],
      ['page.goto: net::ERR_CONNECTION_REFUSED'],
      ['Timeout exceeded while waiting for selector'],
    ])('%s → undefined', (input) => {
      expect(parseErrorName(input)).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('returns undefined for undefined input', () => {
      expect(parseErrorName(undefined)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(parseErrorName('')).toBeUndefined();
    });

    it('matches error name followed by newline', () => {
      expect(parseErrorName('Error\nmessage on next line')).toBe('Error');
    });

    it('matches error name followed by carriage return', () => {
      expect(parseErrorName('Error\rmessage with CR')).toBe('Error');
    });

    it('does not match when bracket separates name from colon', () => {
      expect(parseErrorName('Error [ERR_MODULE_NOT_FOUND]: Cannot find module')).toBeUndefined();
    });

    it('does not match name that does not end in Error', () => {
      expect(parseErrorName('Warning: something deprecated')).toBeUndefined();
    });

    it('does not match lowercase start', () => {
      expect(parseErrorName('error: lowercase')).toBeUndefined();
    });

    it('truncates very long error names to 200 characters', () => {
      const longName = 'A' + 'a'.repeat(300) + 'Error';
      const result = parseErrorName(`${longName}: message`);
      expect(result).toHaveLength(200);
      expect(result).toBe(longName.slice(0, 200));
    });
  });
});
