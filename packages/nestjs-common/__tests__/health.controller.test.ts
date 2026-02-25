import { describe, it, expect } from 'vitest';

import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  it('check() returns status ok with a valid ISO timestamp', () => {
    const controller = new HealthController();
    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
