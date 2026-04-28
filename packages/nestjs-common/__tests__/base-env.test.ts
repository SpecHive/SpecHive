import { describe, it, expect } from 'vitest';

import { baseEnvSchema } from '../src/config/base-env.schema';

describe('baseEnvSchema', () => {
  it('parses a valid config with all fields explicitly provided', () => {
    const result = baseEnvSchema.parse({
      NODE_ENV: 'production',
      PORT: 8080,
      SERVICE_NAME: 'test-service',
    });

    expect(result).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      SERVICE_NAME: 'test-service',
    });
  });

  it('defaults NODE_ENV to "development" when omitted', () => {
    const result = baseEnvSchema.parse({ PORT: 4000, SERVICE_NAME: 'test-service' });

    expect(result.NODE_ENV).toBe('development');
  });

  it('defaults PORT to 3000 when omitted', () => {
    const result = baseEnvSchema.parse({ NODE_ENV: 'test', SERVICE_NAME: 'test-service' });

    expect(result.PORT).toBe(3000);
  });

  it('applies all defaults when SERVICE_NAME is provided', () => {
    const result = baseEnvSchema.parse({ SERVICE_NAME: 'test-service' });

    expect(result).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      SERVICE_NAME: 'test-service',
      METRICS_ENABLED: undefined,
      LOKI_HOST: undefined,
    });
  });

  it('coerces PORT from a string to a number', () => {
    const result = baseEnvSchema.parse({ PORT: '9000', SERVICE_NAME: 'test-service' });

    expect(result.PORT).toBe(9000);
    expect(typeof result.PORT).toBe('number');
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() =>
      baseEnvSchema.parse({ NODE_ENV: 'staging', SERVICE_NAME: 'test-service' }),
    ).toThrow();
  });

  it('rejects when SERVICE_NAME is missing', () => {
    expect(() => baseEnvSchema.parse({})).toThrow(/SERVICE_NAME/);
  });
});
