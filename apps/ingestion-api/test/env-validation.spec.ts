import { describe, it, expect } from 'vitest';

import { envSchema } from '../src/modules/config/env.validation';

const VALID_SECRET = 'test-webhook-secret-at-least-32ch';

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  WEBHOOK_SECRET: VALID_SECRET,
};

const VALID_PRODUCTION_ENV = {
  ...VALID_ENV,
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://app.spechive.dev',
  MINIO_USE_SSL: 'true',
  MINIO_ENDPOINT: 'minio.prod.example.com:9000',
  MINIO_PUBLIC_ENDPOINT: 'cdn.spechive.dev:9000',
  TOKEN_HASH_KEY: 'a'.repeat(32),
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
    const result = envSchema.parse(VALID_PRODUCTION_ENV);
    expect(result.CORS_ORIGIN).toBe('https://app.spechive.dev');
  });

  it('defaults WORKER_WEBHOOK_URL when omitted', () => {
    const result = envSchema.parse(VALID_ENV);
    expect(result.WORKER_WEBHOOK_URL).toBe('http://worker:3001/webhooks/outboxy');
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

  describe('MinIO SSL refinement', () => {
    it('requires MINIO_USE_SSL=true in production for non-localhost endpoints', () => {
      expect(() => envSchema.parse({ ...VALID_PRODUCTION_ENV, MINIO_USE_SSL: 'false' })).toThrow(
        'MINIO_USE_SSL must be true in production for non-localhost endpoints',
      );
    });

    it('allows MINIO_USE_SSL=false for localhost in production', () => {
      const result = envSchema.parse({
        ...VALID_PRODUCTION_ENV,
        MINIO_ENDPOINT: 'localhost:9000',
        MINIO_USE_SSL: 'false',
      });
      expect(result.MINIO_USE_SSL).toBe('false');
    });

    it('allows MINIO_USE_SSL=false for 127.0.0.1 in production', () => {
      const result = envSchema.parse({
        ...VALID_PRODUCTION_ENV,
        MINIO_ENDPOINT: '127.0.0.1:9000',
        MINIO_USE_SSL: 'false',
      });
      expect(result.MINIO_USE_SSL).toBe('false');
    });

    it('allows MINIO_USE_SSL=false for [::1] in production', () => {
      const result = envSchema.parse({
        ...VALID_PRODUCTION_ENV,
        MINIO_ENDPOINT: '[::1]:9000',
        MINIO_USE_SSL: 'false',
      });
      expect(result.MINIO_USE_SSL).toBe('false');
    });

    it('rejects localhost.evil.com as loopback in production', () => {
      expect(() =>
        envSchema.parse({
          ...VALID_PRODUCTION_ENV,
          MINIO_ENDPOINT: 'localhost.evil.com',
          MINIO_USE_SSL: 'false',
        }),
      ).toThrow('MINIO_USE_SSL must be true in production for non-localhost endpoints');
    });

    it('rejects localhost-minio.internal as loopback in production', () => {
      expect(() =>
        envSchema.parse({
          ...VALID_PRODUCTION_ENV,
          MINIO_ENDPOINT: 'localhost-minio.internal',
          MINIO_USE_SSL: 'false',
        }),
      ).toThrow('MINIO_USE_SSL must be true in production for non-localhost endpoints');
    });

    it('allows MINIO_USE_SSL=true for non-localhost in production', () => {
      const result = envSchema.parse(VALID_PRODUCTION_ENV);
      expect(result.MINIO_USE_SSL).toBe('true');
    });

    it('allows MINIO_USE_SSL=false in development', () => {
      const result = envSchema.parse({
        ...VALID_ENV,
        NODE_ENV: 'development',
        MINIO_ENDPOINT: 'minio.dev.example.com:9000',
        MINIO_USE_SSL: 'false',
      });
      expect(result.MINIO_USE_SSL).toBe('false');
    });
  });

  describe('TOKEN_HASH_KEY validation', () => {
    it('allows TOKEN_HASH_KEY to be omitted in development', () => {
      const result = envSchema.parse(VALID_ENV);
      expect(result.TOKEN_HASH_KEY).toBeUndefined();
    });

    it('rejects TOKEN_HASH_KEY omitted in production', () => {
      const envWithoutKey = Object.fromEntries(
        Object.entries(VALID_PRODUCTION_ENV).filter(([k]) => k !== 'TOKEN_HASH_KEY'),
      );
      expect(() => envSchema.parse(envWithoutKey)).toThrow(
        'TOKEN_HASH_KEY is required and must be at least 32 characters in production',
      );
    });

    it('rejects empty string TOKEN_HASH_KEY in production', () => {
      expect(() => envSchema.parse({ ...VALID_PRODUCTION_ENV, TOKEN_HASH_KEY: '' })).toThrow();
    });

    it('rejects TOKEN_HASH_KEY shorter than 32 chars in development', () => {
      expect(() => envSchema.parse({ ...VALID_ENV, TOKEN_HASH_KEY: 'short' })).toThrow();
    });

    it('rejects TOKEN_HASH_KEY under 32 chars in production', () => {
      expect(() =>
        envSchema.parse({ ...VALID_PRODUCTION_ENV, TOKEN_HASH_KEY: 'too-short' }),
      ).toThrow('TOKEN_HASH_KEY is required and must be at least 32 characters in production');
    });

    it('allows TOKEN_HASH_KEY of 32+ chars in production', () => {
      const result = envSchema.parse(VALID_PRODUCTION_ENV);
      expect(result.TOKEN_HASH_KEY).toBe('a'.repeat(32));
    });
  });

  describe('WEBHOOK_SECRET validation', () => {
    it('requires WEBHOOK_SECRET', () => {
      const envWithout = { DATABASE_URL: VALID_ENV.DATABASE_URL };
      expect(() => envSchema.parse(envWithout)).toThrow();
    });

    it('rejects WEBHOOK_SECRET shorter than 32 characters', () => {
      expect(() => envSchema.parse({ ...VALID_ENV, WEBHOOK_SECRET: 'too-short' })).toThrow();
    });

    it('accepts WEBHOOK_SECRET of 32+ characters', () => {
      const result = envSchema.parse(VALID_ENV);
      expect(result.WEBHOOK_SECRET).toBe(VALID_SECRET);
    });

    it('rejects WEBHOOK_SECRET placeholder in production', () => {
      expect(() =>
        envSchema.parse({
          ...VALID_PRODUCTION_ENV,
          WEBHOOK_SECRET: 'change-me-in-production-min-32ch',
        }),
      ).toThrow('WEBHOOK_SECRET must not use a placeholder value in production');
    });

    it('allows WEBHOOK_SECRET placeholder in development', () => {
      const result = envSchema.parse({
        ...VALID_ENV,
        NODE_ENV: 'development',
        WEBHOOK_SECRET: 'change-me-in-production-min-32ch',
      });
      expect(result.WEBHOOK_SECRET).toBe('change-me-in-production-min-32ch');
    });
  });

  describe('MinIO app credentials', () => {
    it('defaults MINIO_APP_ACCESS_KEY to spechive-app', () => {
      const result = envSchema.parse(VALID_ENV);
      expect(result.MINIO_APP_ACCESS_KEY).toBe('spechive-app');
    });

    it('defaults MINIO_APP_SECRET_KEY to spechive-app-secret-key', () => {
      const result = envSchema.parse(VALID_ENV);
      expect(result.MINIO_APP_SECRET_KEY).toBe('spechive-app-secret-key');
    });
  });
});
