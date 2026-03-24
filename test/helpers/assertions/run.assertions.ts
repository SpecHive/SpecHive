import { expect } from 'vitest';

/** Assert that a run object has the minimum required shape (id, status, totalTests). */
export function expectValidRun(run: Record<string, unknown>): void {
  expect(run).toHaveProperty('id');
  expect(run).toHaveProperty('status');
  expect(run).toHaveProperty('totalTests');
}

/** Assert that a run's status matches the expected value. */
export function expectRunStatus(run: Record<string, unknown>, status: string): void {
  expect(run['status']).toBe(status);
}
