import { describe, it, expect } from 'vitest';

import { parsePlaywrightError } from '../src/error-parser.js';

describe('parsePlaywrightError', () => {
  describe('assertion errors', () => {
    it('parses toHaveText with expected value and locator', () => {
      const message = `Error: expect(locator).toHaveText(expected) failed

Locator: locator('h1')
Expected: "Dashboard"
Received: "Welcome! Let's get you set up."
Timeout: 10000ms

Call log:
  - Expect "toHaveText" with timeout 10000ms
  - waiting for locator('h1')`;

      const result = parsePlaywrightError(message);
      expect(result).toEqual({
        errorCategory: 'assertion',
        errorMatcher: 'toHaveText',
        errorTarget: "locator('h1')",
        errorExpected: '"Dashboard"',
        errorActual: '"Welcome! Let\'s get you set up."',
      });
    });

    it('parses toHaveText with element not found (no received value)', () => {
      const message = `Error: expect(locator).toHaveText(expected) failed

Locator: locator('h1')
Expected: "Dashboard"
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" with timeout 10000ms
  - waiting for locator('h1')`;

      const result = parsePlaywrightError(message);
      expect(result).toEqual({
        errorCategory: 'assertion',
        errorMatcher: 'toHaveText',
        errorTarget: "locator('h1')",
        errorExpected: '"Dashboard"',
      });
    });

    it('parses toBeVisible with getByRole locator', () => {
      const message = `Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Signing in/ })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('button', { name: /Signing in/ })`;

      const result = parsePlaywrightError(message);
      expect(result).toEqual({
        errorCategory: 'assertion',
        errorMatcher: 'toBeVisible',
        errorTarget: "getByRole('button', { name: /Signing in/ })",
        errorExpected: 'visible',
      });
    });

    it('parses negated assertion (not.toHaveURL)', () => {
      const message = `Error: expect(page).not.toHaveURL(expected) failed

Expected pattern: not /\\/login/
Received string: "http://localhost:5173/login"
Timeout: 10000ms

Call log:
  - Expect "not toHaveURL" with timeout 10000ms
    14 × unexpected value "http://localhost:5173/login"`;

      const result = parsePlaywrightError(message);
      expect(result).toEqual({
        errorCategory: 'assertion',
        errorMatcher: 'not.toHaveURL',
        errorExpected: 'not /\\/login/',
        errorActual: '"http://localhost:5173/login"',
      });
    });

    it('same assertion + locator + expected produces same result regardless of received value', () => {
      const message1 = `Error: expect(locator).toHaveText(expected) failed

Locator: locator('h1')
Expected: "Dashboard"
Timeout: 10000ms
Error: element(s) not found`;

      const message2 = `Error: expect(locator).toHaveText(expected) failed

Locator: locator('h1')
Expected: "Dashboard"
Received: "Welcome! Let's get you set up."
Timeout: 10000ms`;

      const result1 = parsePlaywrightError(message1);
      const result2 = parsePlaywrightError(message2);

      // These should have the same category, matcher, target, expected
      expect(result1!.errorCategory).toBe(result2!.errorCategory);
      expect(result1!.errorMatcher).toBe(result2!.errorMatcher);
      expect(result1!.errorTarget).toBe(result2!.errorTarget);
      expect(result1!.errorExpected).toBe(result2!.errorExpected);
    });
  });

  describe('timeout errors', () => {
    it('parses page.waitForURL timeout', () => {
      const message = `TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation to "/" until "load"
  navigated to "http://localhost:5173/login"
============================================================`;

      const result = parsePlaywrightError(message);
      expect(result).toEqual({
        errorCategory: 'timeout',
        errorMatcher: 'waitForURL',
        errorTarget: '/',
      });
    });

    it('parses locator.click timeout', () => {
      const message = `locator.click: Timeout 30000ms exceeded.
Call log:
  waiting for locator("#submit-btn")`;

      const result = parsePlaywrightError(message);
      expect(result).toEqual({
        errorCategory: 'timeout',
        errorMatcher: 'click',
        errorTarget: 'locator("#submit-btn")',
      });
    });
  });

  describe('action errors', () => {
    it('parses locator action failure', () => {
      const message = `Error: locator.click: Target closed`;

      const result = parsePlaywrightError(message);
      expect(result).toEqual({
        errorCategory: 'action',
        errorMatcher: 'click',
      });
    });

    it('parses page action failure', () => {
      const message = `Error: page.goto: net::ERR_CONNECTION_REFUSED`;

      const result = parsePlaywrightError(message);
      expect(result).toEqual({
        errorCategory: 'action',
        errorMatcher: 'goto',
      });
    });
  });

  describe('non-Playwright errors', () => {
    it('returns null for generic TypeError', () => {
      const message = `TypeError: Cannot read properties of undefined (reading 'id')`;
      expect(parsePlaywrightError(message)).toBeNull();
    });

    it('returns null for simple error messages', () => {
      const message = `Error: Flaky failure on first attempt`;
      expect(parsePlaywrightError(message)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(parsePlaywrightError(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parsePlaywrightError('')).toBeNull();
    });
  });
});
