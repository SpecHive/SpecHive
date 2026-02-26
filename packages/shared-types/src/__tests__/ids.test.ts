import { describe, it, expect } from 'vitest';

import {
  asOrganizationId,
  asProjectId,
  asRunId,
  asSuiteId,
  asTestId,
  asArtifactId,
  asUserId,
  asMembershipId,
  asProjectTokenId,
} from '../ids.js';

describe('Branded ID helpers', () => {
  const uuid = '01970000-0000-7000-8000-000000000001';

  const helpers = [
    { name: 'asOrganizationId', fn: asOrganizationId },
    { name: 'asProjectId', fn: asProjectId },
    { name: 'asRunId', fn: asRunId },
    { name: 'asSuiteId', fn: asSuiteId },
    { name: 'asTestId', fn: asTestId },
    { name: 'asArtifactId', fn: asArtifactId },
    { name: 'asUserId', fn: asUserId },
    { name: 'asMembershipId', fn: asMembershipId },
    { name: 'asProjectTokenId', fn: asProjectTokenId },
  ] as const;

  it.each(helpers)('$name preserves the original string value', ({ fn }) => {
    expect(fn(uuid)).toBe(uuid);
  });

  it.each(helpers)('$name returns a string type at runtime', ({ fn }) => {
    expect(typeof fn('test')).toBe('string');
  });
});
