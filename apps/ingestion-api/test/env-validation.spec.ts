import { describe, it, expect } from 'vitest';

import { envSchema } from '../src/modules/config/env.validation';

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
};

describe('ingestion-api envSchema', () => {
  it('parses valid config with required DATABASE_URL', () => {
    const result = envSchema.parse(VALID_ENV);
    expect(result.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
  });

  it('requires DATABASE_URL', () => {
    expect(() => envSchema.parse({})).toThrow();
  });

  it('rejects invalid DATABASE_URL', () => {
    expect(() => envSchema.parse({ DATABASE_URL: 'not-a-url' })).toThrow();
  });

  it('defaults CORS_ORIGIN to http://localhost:5173', () => {
    const result = envSchema.parse(VALID_ENV);
    expect(result.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('rejects CORS_ORIGIN containing localhost in production', () => {
    expect(() =>
      envSchema.parse({
        ...VALID_ENV,
        NODE_ENV: 'production',
        CORS_ORIGIN: 'http://localhost:5173',
      }),
    ).toThrow('CORS_ORIGIN must not contain localhost in production');
  });

  it('allows CORS_ORIGIN with localhost in development', () => {
    const result = envSchema.parse({
      ...VALID_ENV,
      NODE_ENV: 'development',
      CORS_ORIGIN: 'http://localhost:3000',
    });
    expect(result.CORS_ORIGIN).toBe('http://localhost:3000');
  });

  it('allows a non-localhost CORS_ORIGIN in production', () => {
    const result = envSchema.parse({
      ...VALID_ENV,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://app.assertly.dev',
    });
    expect(result.CORS_ORIGIN).toBe('https://app.assertly.dev');
  });

  it('WORKER_WEBHOOK_URL is optional', () => {
    const result = envSchema.parse(VALID_ENV);
    expect(result.WORKER_WEBHOOK_URL).toBeUndefined();
  });

  it('accepts a valid WORKER_WEBHOOK_URL', () => {
    const result = envSchema.parse({
      ...VALID_ENV,
      WORKER_WEBHOOK_URL: 'http://worker:3001/webhooks/outboxy',
    });
    expect(result.WORKER_WEBHOOK_URL).toBe('http://worker:3001/webhooks/outboxy');
  });

  it('inherits NODE_ENV default from base schema', () => {
    const result = envSchema.parse(VALID_ENV);
    expect(result.NODE_ENV).toBe('development');
  });

  it('inherits PORT default from base schema', () => {
    const result = envSchema.parse(VALID_ENV);
    expect(result.PORT).toBe(3000);
  });
});
