import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLOUD_API_URL, parseBoolean, resolveBaseConfig } from '../src/config.js';

describe('parseBoolean', () => {
  it('returns defaultValue for undefined', () => {
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parseBoolean(undefined, false)).toBe(false);
  });

  it('returns true for "true"', () => {
    expect(parseBoolean('true', false)).toBe(true);
  });

  it('returns true for "1"', () => {
    expect(parseBoolean('1', false)).toBe(true);
  });

  it('returns true for "TRUE" (case-insensitive)', () => {
    expect(parseBoolean('TRUE', false)).toBe(true);
  });

  it('returns true for " true " (whitespace)', () => {
    expect(parseBoolean(' true ', false)).toBe(true);
  });

  it('returns false for "false"', () => {
    expect(parseBoolean('false', true)).toBe(false);
  });

  it('returns false for "0"', () => {
    expect(parseBoolean('0', true)).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(parseBoolean('yes', true)).toBe(false);
  });
});

describe('resolveBaseConfig', () => {
  beforeEach(() => {
    // Ensure env vars are absent (not empty string — resolveBaseConfig uses ?? not ||)
    delete process.env.SPECHIVE_API_URL;
    delete process.env.SPECHIVE_PROJECT_TOKEN;
    delete process.env.SPECHIVE_ENABLED;
    delete process.env.SPECHIVE_RUN_NAME;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('defaults apiUrl to cloud URL when no apiUrl provided', () => {
    const config = resolveBaseConfig({ projectToken: 'tok-123' });
    expect(config.apiUrl).toBe(CLOUD_API_URL);
  });

  it('uses explicit apiUrl from config', () => {
    const config = resolveBaseConfig({ apiUrl: 'https://custom.api', projectToken: 'tok-123' });
    expect(config.apiUrl).toBe('https://custom.api');
  });

  it('uses SPECHIVE_API_URL env var when no config apiUrl', () => {
    vi.stubEnv('SPECHIVE_API_URL', 'https://env.api');
    const config = resolveBaseConfig({ projectToken: 'tok-123' });
    expect(config.apiUrl).toBe('https://env.api');
  });

  it('falls back to cloud URL when SPECHIVE_API_URL is empty string', () => {
    vi.stubEnv('SPECHIVE_API_URL', '');
    const config = resolveBaseConfig({ projectToken: 'tok-123' });
    expect(config.apiUrl).toBe(CLOUD_API_URL);
  });

  it('config apiUrl overrides SPECHIVE_API_URL env var', () => {
    vi.stubEnv('SPECHIVE_API_URL', 'https://env.api');
    const config = resolveBaseConfig({ apiUrl: 'https://config.api', projectToken: 'tok-123' });
    expect(config.apiUrl).toBe('https://config.api');
  });

  it('auto-disables with warning when projectToken is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = resolveBaseConfig({});

    expect(config.enabled).toBe(false);
    expect(config.projectToken).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('missing projectToken'));
  });

  it('auto-disables silently when enabled: false and no token', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = resolveBaseConfig({ enabled: false });

    expect(config.enabled).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses SPECHIVE_PROJECT_TOKEN env var when no config token', () => {
    vi.stubEnv('SPECHIVE_PROJECT_TOKEN', 'env-tok');
    const config = resolveBaseConfig({});

    expect(config.projectToken).toBe('env-tok');
    expect(config.enabled).toBe(true);
  });

  it('SPECHIVE_ENABLED=false disables reporter', () => {
    vi.stubEnv('SPECHIVE_ENABLED', 'false');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = resolveBaseConfig({ projectToken: 'tok-123' });

    expect(config.enabled).toBe(false);
  });

  it('applies default values for optional fields', () => {
    const config = resolveBaseConfig({ projectToken: 'tok-123' });

    expect(config.maxRetries).toBe(3);
    expect(config.flushTimeout).toBe(30_000);
    expect(config.failOnConnectionError).toBe(false);
    expect(config.metadata).toEqual({});
    expect(config.runName).toBeUndefined();
  });

  it('uses SPECHIVE_RUN_NAME env var when no config runName', () => {
    vi.stubEnv('SPECHIVE_RUN_NAME', 'Nightly Run');
    const config = resolveBaseConfig({ projectToken: 'tok-123' });

    expect(config.runName).toBe('Nightly Run');
  });

  it('config runName overrides SPECHIVE_RUN_NAME env var', () => {
    vi.stubEnv('SPECHIVE_RUN_NAME', 'Env Run');
    const config = resolveBaseConfig({ projectToken: 'tok-123', runName: 'Config Run' });

    expect(config.runName).toBe('Config Run');
  });
});
