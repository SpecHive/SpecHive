import { describe, it, expect } from 'vitest';

import { RunStatus, TestStatus, ArtifactType, MembershipRole } from '../enums.js';

describe('Enum values', () => {
  it('RunStatus has expected values', () => {
    expect(Object.values(RunStatus)).toEqual(
      expect.arrayContaining(['pending', 'running', 'passed', 'failed', 'cancelled']),
    );
    expect(Object.values(RunStatus)).toHaveLength(5);
  });

  it('TestStatus has expected values', () => {
    expect(Object.values(TestStatus)).toEqual(
      expect.arrayContaining(['pending', 'running', 'passed', 'failed', 'skipped', 'flaky']),
    );
    expect(Object.values(TestStatus)).toHaveLength(6);
  });

  it('ArtifactType has expected values', () => {
    expect(Object.values(ArtifactType)).toEqual(
      expect.arrayContaining(['screenshot', 'video', 'trace', 'log', 'other']),
    );
    expect(Object.values(ArtifactType)).toHaveLength(5);
  });

  it('MembershipRole has expected values', () => {
    expect(Object.values(MembershipRole)).toEqual(
      expect.arrayContaining(['owner', 'admin', 'member', 'viewer']),
    );
    expect(Object.values(MembershipRole)).toHaveLength(4);
  });
});
