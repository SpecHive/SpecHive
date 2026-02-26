import { describe, it, expect } from 'vitest';

import { envSchema } from '../src/modules/config/env.validation';

const VALID_SECRET = 'a]pI0$h8?GxR5^Tf2Lw@m9Nz&kJ7dYqX'; // 33 chars, satisfies min(32)

const VALID_WORKER_ENV = { WEBHOOK_SECRET: VALID_SECRET };

describe('worker envSchema', () => {
  it('parses valid config with WEBHOOK_SECRET', () => {
    const result = envSchema.parse(VALID_WORKER_ENV);
    expect(result.WEBHOOK_SECRET).toBe(VALID_SECRET);
  });

  it('requires WEBHOOK_SECRET', () => {
    expect(() => envSchema.parse({})).toThrow();
  });

  it('rejects WEBHOOK_SECRET shorter than 32 characters', () => {
    expect(() => envSchema.parse({ WEBHOOK_SECRET: 'too-short' })).toThrow();
  });

  it('accepts WEBHOOK_SECRET exactly 32 characters', () => {
    const secret32 = 'a'.repeat(32);
    const result = envSchema.parse({ WEBHOOK_SECRET: secret32 });
    expect(result.WEBHOOK_SECRET).toBe(secret32);
  });

  it('defaults PORT to 3001 (overrides base default of 3000)', () => {
    const result = envSchema.parse(VALID_WORKER_ENV);
    expect(result.PORT).toBe(3001);
  });

  it('coerces PORT from string', () => {
    const result = envSchema.parse({ ...VALID_WORKER_ENV, PORT: '4000' });
    expect(result.PORT).toBe(4000);
  });

  it('inherits NODE_ENV default from base schema', () => {
    const result = envSchema.parse(VALID_WORKER_ENV);
    expect(result.NODE_ENV).toBe('development');
  });

  it('rejects WEBHOOK_SECRET placeholder in production', () => {
    expect(() =>
      envSchema.parse({
        ...VALID_WORKER_ENV,
        NODE_ENV: 'production',
        WEBHOOK_SECRET: 'change-me-in-production-min-32ch',
      }),
    ).toThrow('WEBHOOK_SECRET must not use a placeholder value in production');
  });

  it('allows WEBHOOK_SECRET placeholder in development', () => {
    const result = envSchema.parse({
      ...VALID_WORKER_ENV,
      NODE_ENV: 'development',
      WEBHOOK_SECRET: 'change-me-in-production-min-32ch',
    });
    expect(result.WEBHOOK_SECRET).toBe('change-me-in-production-min-32ch');
  });
});
