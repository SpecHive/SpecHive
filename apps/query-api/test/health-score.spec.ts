import { describe, it, expect } from 'vitest';

import {
  computeHealthScore,
  computeOrgMedianDuration,
  computeFlakyScore,
  computeDurationScore,
} from '../src/modules/analytics/health-score';

// ---------------------------------------------------------------------------
// computeOrgMedianDuration
// ---------------------------------------------------------------------------

describe('computeOrgMedianDuration', () => {
  it('returns 0 for empty array', () => {
    expect(computeOrgMedianDuration([])).toBe(0);
  });

  it('returns the single element for length-1 array', () => {
    expect(computeOrgMedianDuration([500])).toBe(500);
  });

  it('returns median of odd-length array', () => {
    expect(computeOrgMedianDuration([100, 300, 200])).toBe(200);
  });

  it('returns average of two middle elements for even-length array', () => {
    expect(computeOrgMedianDuration([100, 200, 300, 400])).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// computeFlakyScore
// ---------------------------------------------------------------------------

describe('computeFlakyScore', () => {
  it('returns 100 for 0% flaky', () => {
    expect(computeFlakyScore(0)).toBe(100);
  });

  it('returns ~90.25 for 5% flaky', () => {
    expect(computeFlakyScore(5)).toBeCloseTo(90.25, 2);
  });

  it('returns 49 for 30% flaky', () => {
    expect(computeFlakyScore(30)).toBeCloseTo(49, 2);
  });

  it('returns 25 for 50% flaky', () => {
    expect(computeFlakyScore(50)).toBeCloseTo(25, 2);
  });

  it('returns 0 for 100% flaky', () => {
    expect(computeFlakyScore(100)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeDurationScore
// ---------------------------------------------------------------------------

describe('computeDurationScore', () => {
  it('returns 100 when ratio is below 0.5x median', () => {
    expect(computeDurationScore(200, 1000, 5)).toBe(100);
  });

  it('returns 80 at 1.0x median', () => {
    expect(computeDurationScore(1000, 1000, 5)).toBe(80);
  });

  it('returns 60 at 1.5x median', () => {
    expect(computeDurationScore(1500, 1000, 5)).toBeCloseTo(60, 1);
  });

  it('returns 0 at 3.0x median', () => {
    expect(computeDurationScore(3000, 1000, 5)).toBe(0);
  });

  it('returns 0 above 3.0x median', () => {
    expect(computeDurationScore(5000, 1000, 5)).toBe(0);
  });

  it('returns neutral 80 when projectCount < 3', () => {
    expect(computeDurationScore(5000, 1000, 2)).toBe(80);
  });

  it('returns neutral 80 when orgMedianDurationMs is 0', () => {
    expect(computeDurationScore(1000, 0, 10)).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// computeHealthScore — calibration table
// ---------------------------------------------------------------------------

describe('computeHealthScore', () => {
  const base = {
    orgMedianDurationMs: 1000,
    projectCount: 5,
  };

  it('perfect project → 98.0 (green)', () => {
    const score = computeHealthScore({
      passRate: 100,
      flakyRate: 0,
      skipRate: 0,
      avgDurationMs: 1000,
      ...base,
    });
    expect(score).toBe(98);
  });

  it('strong project, 3% flaky → ~94.5 (green)', () => {
    const score = computeHealthScore({
      passRate: 98,
      flakyRate: 3,
      skipRate: 2,
      avgDurationMs: 800,
      ...base,
    });
    expect(score).toBeGreaterThanOrEqual(90);
    expect(score).toBeLessThan(96);
  });

  it('good project, 5% flaky → ~89.9 (yellow boundary)', () => {
    const score = computeHealthScore({
      passRate: 95,
      flakyRate: 5,
      skipRate: 5,
      avgDurationMs: 1000,
      ...base,
    });
    expect(score).toBeGreaterThanOrEqual(88);
    expect(score).toBeLessThan(91);
  });

  it('15% flaky → ~77 (yellow)', () => {
    const score = computeHealthScore({
      passRate: 90,
      flakyRate: 15,
      skipRate: 5,
      avgDurationMs: 1200,
      ...base,
    });
    expect(score).toBeGreaterThanOrEqual(70);
    expect(score).toBeLessThan(80);
  });

  it('30% flaky with failures → ~62 (orange)', () => {
    const score = computeHealthScore({
      passRate: 85,
      flakyRate: 30,
      skipRate: 5,
      avgDurationMs: 1000,
      ...base,
    });
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThan(70);
  });

  it('30% flaky with high pass rate → ~67 (orange, was 90 green)', () => {
    const score = computeHealthScore({
      passRate: 95,
      flakyRate: 30,
      skipRate: 0,
      avgDurationMs: 1000,
      ...base,
    });
    expect(score).toBeGreaterThanOrEqual(60);
    expect(score).toBeLessThan(70);
  });

  it('50% flaky → ~42 (red)', () => {
    const score = computeHealthScore({
      passRate: 80,
      flakyRate: 50,
      skipRate: 0,
      avgDurationMs: 1500,
      ...base,
    });
    expect(score).toBeLessThan(50);
    expect(score).toBeGreaterThan(30);
  });

  it('all tests skipped → 0 (red, was 35)', () => {
    const score = computeHealthScore({
      passRate: 0,
      flakyRate: 0,
      skipRate: 100,
      avgDurationMs: 0,
      ...base,
    });
    expect(score).toBe(0);
  });

  it('90% skipped → red (< 50)', () => {
    const score = computeHealthScore({
      passRate: 80,
      flakyRate: 0,
      skipRate: 90,
      avgDurationMs: 500,
      ...base,
    });
    expect(score).toBeLessThan(50);
    expect(score).toBeGreaterThan(0);
  });

  it('moderate skip (20%), low flaky → ~91 (green)', () => {
    const score = computeHealthScore({
      passRate: 95,
      flakyRate: 2,
      skipRate: 20,
      avgDurationMs: 1000,
      ...base,
    });
    expect(score).toBeGreaterThanOrEqual(88);
    expect(score).toBeLessThanOrEqual(93);
  });

  it('slow but healthy (2.5x median) → ~90 (yellow boundary)', () => {
    const score = computeHealthScore({
      passRate: 98,
      flakyRate: 1,
      skipRate: 2,
      avgDurationMs: 2500,
      ...base,
    });
    expect(score).toBeGreaterThanOrEqual(85);
    expect(score).toBeLessThan(91);
  });
});

// ---------------------------------------------------------------------------
// computeHealthScore — edge cases & input validation
// ---------------------------------------------------------------------------

describe('computeHealthScore — edge cases', () => {
  const base = {
    orgMedianDurationMs: 1000,
    projectCount: 5,
  };

  it('NaN passRate does not produce NaN', () => {
    const score = computeHealthScore({
      passRate: NaN,
      flakyRate: 0,
      skipRate: 0,
      avgDurationMs: 1000,
      ...base,
    });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('NaN flakyRate does not produce NaN', () => {
    const score = computeHealthScore({
      passRate: 90,
      flakyRate: NaN,
      skipRate: 0,
      avgDurationMs: 1000,
      ...base,
    });
    expect(Number.isFinite(score)).toBe(true);
  });

  it('Infinity input does not produce Infinity', () => {
    const score = computeHealthScore({
      passRate: Infinity,
      flakyRate: 0,
      skipRate: 0,
      avgDurationMs: 1000,
      ...base,
    });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('negative inputs are clamped to 0', () => {
    const score = computeHealthScore({
      passRate: -10,
      flakyRate: -5,
      skipRate: -20,
      avgDurationMs: 1000,
      ...base,
    });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('inputs above 100 are clamped', () => {
    const score = computeHealthScore({
      passRate: 150,
      flakyRate: 0,
      skipRate: 0,
      avgDurationMs: 1000,
      ...base,
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  it('result is always rounded to at most 1 decimal place', () => {
    const score = computeHealthScore({
      passRate: 87.33,
      flakyRate: 3.21,
      skipRate: 2.17,
      avgDurationMs: 1200,
      ...base,
    });
    const decimalPlaces = (score.toString().split('.')[1] ?? '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(1);
  });

  it('result is clamped between 0 and 100', () => {
    const score = computeHealthScore({
      passRate: 0,
      flakyRate: 100,
      skipRate: 100,
      avgDurationMs: 10000,
      ...base,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
