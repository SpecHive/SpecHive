import { describe, it, expect } from 'vitest';

import { envSchema } from '../src/modules/config/env.validation';

const VALID_SECRET = 'a]pI0$h8?GxR5^Tf2Lw@m9Nz&kJ7dYqX'; // 33 chars, satisfies min(32)
const VALID_DATABASE_URL = 'postgres://user:pass@localhost:5432/assertly';

const VALID_WORKER_ENV = {
  WEBHOOK_SECRET: VALID_SECRET,
  DATABASE_URL: VALID_DATABASE_URL,
};

describe('worker envSchema', () => {
  it('parses valid config with WEBHOOK_SECRET and DATABASE_URL', () => {
    const result = envSchema.parse(VALID_WORKER_ENV);
    expect(result.WEBHOOK_SECRET).toBe(VALID_SECRET);
    expect(result.DATABASE_URL).toBe(VALID_DATABASE_URL);
  });

  it('requires WEBHOOK_SECRET', () => {
    expect(() => envSchema.parse({ DATABASE_URL: VALID_DATABASE_URL })).toThrow();
  });

  it('requires DATABASE_URL', () => {
    expect(() => envSchema.parse({ WEBHOOK_SECRET: VALID_SECRET })).toThrow();
  });

  it('rejects invalid DATABASE_URL', () => {
    expect(() =>
      envSchema.parse({ WEBHOOK_SECRET: VALID_SECRET, DATABASE_URL: 'not-a-url' }),
    ).toThrow();
  });

  it('rejects WEBHOOK_SECRET shorter than 32 characters', () => {
    expect(() =>
      envSchema.parse({ WEBHOOK_SECRET: 'too-short', DATABASE_URL: VALID_DATABASE_URL }),
    ).toThrow();
  });

  it('accepts WEBHOOK_SECRET exactly 32 characters', () => {
    const secret32 = 'a'.repeat(32);
    const result = envSchema.parse({ ...VALID_WORKER_ENV, WEBHOOK_SECRET: secret32 });
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

  describe('MINIO env vars', () => {
    it('provides MINIO defaults', () => {
      const result = envSchema.parse(VALID_WORKER_ENV);
      expect(result.MINIO_ENDPOINT).toBe('localhost:9000');
      expect(result.MINIO_USE_SSL).toBe('false');
      expect(result.MINIO_BUCKET).toBe('assertly-artifacts');
      expect(result.MINIO_APP_ACCESS_KEY).toBe('assertly-app');
      expect(result.MINIO_APP_SECRET_KEY).toBe('assertly-app-secret-key');
    });

    it('accepts custom MINIO values', () => {
      const result = envSchema.parse({
        ...VALID_WORKER_ENV,
        MINIO_ENDPOINT: 's3.amazonaws.com',
        MINIO_USE_SSL: 'true',
        MINIO_BUCKET: 'my-bucket',
        MINIO_APP_ACCESS_KEY: 'my-key',
        MINIO_APP_SECRET_KEY: 'my-secret',
      });
      expect(result.MINIO_ENDPOINT).toBe('s3.amazonaws.com');
      expect(result.MINIO_USE_SSL).toBe('true');
      expect(result.MINIO_BUCKET).toBe('my-bucket');
    });

    it('rejects non-SSL MINIO in production for non-loopback endpoints', () => {
      expect(() =>
        envSchema.parse({
          ...VALID_WORKER_ENV,
          NODE_ENV: 'production',
          MINIO_ENDPOINT: 's3.amazonaws.com',
          MINIO_USE_SSL: 'false',
        }),
      ).toThrow('MINIO_USE_SSL must be true in production for non-localhost endpoints');
    });

    it('allows non-SSL MINIO in production for localhost', () => {
      const result = envSchema.parse({
        ...VALID_WORKER_ENV,
        NODE_ENV: 'production',
        MINIO_ENDPOINT: 'localhost:9000',
        MINIO_PUBLIC_ENDPOINT: 'cdn.assertly.dev:9000',
        MINIO_USE_SSL: 'false',
      });
      expect(result.MINIO_USE_SSL).toBe('false');
    });
  });
});
