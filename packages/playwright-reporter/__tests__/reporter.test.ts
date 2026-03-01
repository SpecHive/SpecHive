import { describe, it, expect } from 'vitest';

import AssertlyReporter from '../src/index.js';

describe('AssertlyReporter', () => {
  it('instantiates with required config', () => {
    const reporter = new AssertlyReporter({
      apiUrl: 'https://api.assertly.dev',
      projectToken: 'test-token',
    });
    expect(reporter).toBeDefined();
  });

  it('applies default config values', () => {
    const reporter = new AssertlyReporter({
      apiUrl: 'https://api.assertly.dev',
      projectToken: 'test-token',
    });
    expect(reporter.isEnabled).toBe(true);
  });

  it('respects enabled: false config', () => {
    const reporter = new AssertlyReporter({
      apiUrl: 'https://api.assertly.dev',
      projectToken: 'test-token',
      enabled: false,
    });
    expect(reporter.isEnabled).toBe(false);
  });

  it('has required Reporter methods', () => {
    const reporter = new AssertlyReporter({
      apiUrl: 'https://api.assertly.dev',
      projectToken: 'test-token',
    });
    expect(typeof reporter.onBegin).toBe('function');
    expect(typeof reporter.onTestBegin).toBe('function');
    expect(typeof reporter.onTestEnd).toBe('function');
    expect(typeof reporter.onEnd).toBe('function');
  });

  it('methods accept mock data without throwing', () => {
    const reporter = new AssertlyReporter({
      apiUrl: 'https://api.assertly.dev',
      projectToken: 'test-token',
    });
    expect(() => reporter.onBegin({} as never, {} as never)).not.toThrow();
    expect(() => reporter.onTestBegin({} as never)).not.toThrow();
    expect(() => reporter.onTestEnd({} as never, {} as never)).not.toThrow();
    expect(() => reporter.onEnd({} as never)).not.toThrow();
  });
});
