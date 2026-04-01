import { MAX_ERROR_FIELD_LENGTH } from '@spechive/shared-types';
import type { ErrorCategory } from '@spechive/shared-types';

export interface ParsedPlaywrightError {
  errorCategory: ErrorCategory;
  errorMatcher?: string;
  errorTarget?: string;
  errorExpected?: string;
  errorActual?: string;
}

// expect(locator).toHaveText(expected) failed
// expect(page).not.toHaveURL(expected) failed
const ASSERTION_RE = /^(?:Error:\s*)?expect\(\w+\)\.((?:not\.)?(\w+))\([^)]*\)\s+failed/m;

// Locator: locator('h1')
// Locator:  locator('h1')
const LOCATOR_RE = /^Locator:\s*(.+)$/m;

// Expected: "Dashboard"
// Expected pattern: not /\/login/
// Expected string: "http://localhost:5173/"
const EXPECTED_RE = /^Expected(?:\s+(?:pattern|string|value))?:\s*(.+)$/m;

// Received: "Welcome! Let's get you set up."
// Received string: "http://localhost:5173/login"
const RECEIVED_RE = /^Received(?:\s+(?:pattern|string|value))?:\s*(.+)$/m;

// page.waitForURL: Timeout 15000ms exceeded.
// locator.click: Timeout 30000ms exceeded.
const TIMEOUT_RE = /^(?:(?:\w+Error):\s*)?(?:(\w+)\.)?(\w+):\s*Timeout\s+\d+ms\s+exceeded/m;

// locator.click: Target closed
// page.goto: net::ERR_CONNECTION_REFUSED
const ACTION_RE =
  /^(?:Error:\s*)?(locator|page|frame|elementHandle|browserContext)\.(\w+):\s*(.+)/m;

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function parseAssertion(message: string): ParsedPlaywrightError | null {
  const match = message.match(ASSERTION_RE);
  if (!match) return null;

  const errorMatcher = match[1]; // e.g. "toHaveText" or "not.toHaveURL"
  const target = message.match(LOCATOR_RE)?.[1]?.trim();
  const expected = message.match(EXPECTED_RE)?.[1]?.trim();
  const actual = message.match(RECEIVED_RE)?.[1]?.trim();

  return {
    errorCategory: 'assertion',
    errorMatcher,
    ...(target ? { errorTarget: truncate(target, MAX_ERROR_FIELD_LENGTH) } : {}),
    ...(expected ? { errorExpected: truncate(expected, MAX_ERROR_FIELD_LENGTH) } : {}),
    ...(actual ? { errorActual: truncate(actual, MAX_ERROR_FIELD_LENGTH) } : {}),
  };
}

function parseTimeout(message: string): ParsedPlaywrightError | null {
  const match = message.match(TIMEOUT_RE);
  if (!match) return null;

  const action = match[2]; // e.g. "waitForURL", "click"

  // Try to extract the target from the log section
  // e.g. waiting for navigation to "/" until "load"
  // e.g. waiting for locator("#submit-btn")
  const navMatch = message.match(/waiting for navigation to ["']([^"']+)["']/);
  const locatorMatch = message.match(/waiting for (locator\([^)]+\))/);
  const target = message.match(LOCATOR_RE)?.[1]?.trim() ?? navMatch?.[1] ?? locatorMatch?.[1];

  return {
    errorCategory: 'timeout',
    errorMatcher: action,
    ...(target ? { errorTarget: truncate(target, MAX_ERROR_FIELD_LENGTH) } : {}),
  };
}

function parseAction(message: string): ParsedPlaywrightError | null {
  const firstLine = message.split('\n')[0]?.trim();
  if (!firstLine) return null;

  const match = firstLine.match(ACTION_RE);
  if (!match) return null;

  const object = match[1]; // e.g. "page", "locator"
  const method = match[2]; // e.g. "click", "goto"

  return {
    errorCategory: 'action',
    errorMatcher: method,
    errorTarget: truncate(`${object}.${method}`, MAX_ERROR_FIELD_LENGTH),
  };
}

/**
 * Parses a Playwright error message into structured fields.
 * Returns null if the message doesn't match any known Playwright error pattern.
 */
export function parsePlaywrightError(message: string | undefined): ParsedPlaywrightError | null {
  if (!message) return null;

  return parseAssertion(message) ?? parseTimeout(message) ?? parseAction(message);
}
