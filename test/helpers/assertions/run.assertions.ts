import { expect } from 'vitest';

export function expectValidRun(run: Record<string, unknown>): void {
  expect(run).toHaveProperty('id');
  expect(run).toHaveProperty('status');
  expect(run).toHaveProperty('totalTests');
}

export function expectRunStatus(run: Record<string, unknown>, status: string): void {
  expect(run['status']).toBe(status);
}
