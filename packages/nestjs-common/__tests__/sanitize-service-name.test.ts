import { describe, expect, it } from 'vitest';

import { sanitizeServiceName } from '../src/utils/sanitize-service-name';

describe('sanitizeServiceName', () => {
  it('replaces hyphens with underscores', () => {
    expect(sanitizeServiceName('cloud-gateway')).toBe('cloud_gateway');
  });

  it('leaves names without hyphens unchanged', () => {
    expect(sanitizeServiceName('worker')).toBe('worker');
  });

  it('replaces multiple hyphens', () => {
    expect(sanitizeServiceName('my-cool-service')).toBe('my_cool_service');
  });

  it('uses default fallback when name is undefined', () => {
    expect(sanitizeServiceName(undefined)).toBe('spechive');
  });

  it('uses default fallback when name is empty string', () => {
    expect(sanitizeServiceName('')).toBe('spechive');
  });

  it('respects custom fallback', () => {
    expect(sanitizeServiceName(undefined, 'app-name')).toBe('app_name');
  });

  it('preserves underscores already in the name', () => {
    expect(sanitizeServiceName('query_api')).toBe('query_api');
  });
});
