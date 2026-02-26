import { describe, it, expect } from 'vitest';

import { baseEnvSchema } from '../src/config/base-env.schema';

const VALID_HASH_KEY = 'test-token-hash-key-minimum-32-characters';

describe('baseEnvSchema', () => {
  it('parses a valid config with all fields explicitly provided', () => {
    const result = baseEnvSchema.parse({
      NODE_ENV: 'production',
      PORT: 8080,
      TOKEN_HASH_KEY: VALID_HASH_KEY,
    });

    expect(result).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      TOKEN_HASH_KEY: VALID_HASH_KEY,
    });
  });

  it('defaults NODE_ENV to "development" when omitted', () => {
    const result = baseEnvSchema.parse({ PORT: 4000, TOKEN_HASH_KEY: VALID_HASH_KEY });

    expect(result.NODE_ENV).toBe('development');
  });

  it('defaults PORT to 3000 when omitted', () => {
    const result = baseEnvSchema.parse({ NODE_ENV: 'test', TOKEN_HASH_KEY: VALID_HASH_KEY });

    expect(result.PORT).toBe(3000);
  });

  it('applies defaults when only TOKEN_HASH_KEY is provided', () => {
    const result = baseEnvSchema.parse({ TOKEN_HASH_KEY: VALID_HASH_KEY });

    expect(result).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      TOKEN_HASH_KEY: VALID_HASH_KEY,
    });
  });

  it('coerces PORT from a string to a number', () => {
    const result = baseEnvSchema.parse({ PORT: '9000', TOKEN_HASH_KEY: VALID_HASH_KEY });

    expect(result.PORT).toBe(9000);
    expect(typeof result.PORT).toBe('number');
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() =>
      baseEnvSchema.parse({ NODE_ENV: 'staging', TOKEN_HASH_KEY: VALID_HASH_KEY }),
    ).toThrow();
  });

  it('requires TOKEN_HASH_KEY', () => {
    expect(() => baseEnvSchema.parse({})).toThrow();
  });

  it('rejects TOKEN_HASH_KEY shorter than 32 characters', () => {
    expect(() => baseEnvSchema.parse({ TOKEN_HASH_KEY: 'too-short' })).toThrow();
  });
});
