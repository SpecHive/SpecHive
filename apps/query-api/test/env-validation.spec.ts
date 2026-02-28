import { describe, it, expect } from 'vitest';

import { envSchema } from '../src/modules/config/env.validation';

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'dev-secret',
};

const VALID_PRODUCTION_ENV = {
  ...VALID_ENV,
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://app.assertly.dev',
  MINIO_USE_SSL: 'true',
  MINIO_ENDPOINT: 'minio.prod.example.com:9000',
  JWT_SECRET: 'a'.repeat(64),
};

describe('query-api envSchema', () => {
  it('parses valid config with required DATABASE_URL and JWT_SECRET', () => {
    const result = envSchema.parse(VALID_ENV);
    expect(result.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(result.JWT_SECRET).toBe(VALID_ENV.JWT_SECRET);
  });

  it('requires DATABASE_URL', () => {
    expect(() => envSchema.parse({ JWT_SECRET: 'test' })).toThrow();
  });

  it('requires JWT_SECRET', () => {
    expect(() =>
      envSchema.parse({ DATABASE_URL: 'postgresql://user:pass@localhost:5432/db' }),
    ).toThrow();
  });

  it('defaults JWT_EXPIRES_IN to 24h', () => {
    const result = envSchema.parse(VALID_ENV);
    expect(result.JWT_EXPIRES_IN).toBe('24h');
  });

  it('defaults CORS_ORIGIN to http://localhost:5173', () => {
    const result = envSchema.parse(VALID_ENV);
    expect(result.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('rejects CORS_ORIGIN containing localhost in production', () => {
    expect(() =>
      envSchema.parse({
        ...VALID_PRODUCTION_ENV,
        CORS_ORIGIN: 'http://localhost:5173',
      }),
    ).toThrow('CORS_ORIGIN must not contain localhost in production');
  });

  it('allows a non-localhost CORS_ORIGIN in production', () => {
    const result = envSchema.parse(VALID_PRODUCTION_ENV);
    expect(result.CORS_ORIGIN).toBe('https://app.assertly.dev');
  });

  describe('JWT_SECRET length in production', () => {
    it('rejects JWT_SECRET under 64 chars in production', () => {
      expect(() => envSchema.parse({ ...VALID_PRODUCTION_ENV, JWT_SECRET: 'too-short' })).toThrow(
        'JWT_SECRET must be at least 64 characters in production',
      );
    });

    it('allows short JWT_SECRET in development', () => {
      const result = envSchema.parse(VALID_ENV);
      expect(result.JWT_SECRET).toBe('dev-secret');
    });

    it('allows JWT_SECRET of 64+ chars in production', () => {
      const result = envSchema.parse(VALID_PRODUCTION_ENV);
      expect(result.JWT_SECRET).toBe('a'.repeat(64));
    });
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

    it('allows MINIO_USE_SSL=false in development', () => {
      const result = envSchema.parse({
        ...VALID_ENV,
        MINIO_ENDPOINT: 'minio.dev.example.com:9000',
        MINIO_USE_SSL: 'false',
      });
      expect(result.MINIO_USE_SSL).toBe('false');
    });
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
