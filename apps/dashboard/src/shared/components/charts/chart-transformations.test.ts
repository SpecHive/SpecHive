import { describe, it, expect } from 'vitest';

import { formatDateLabel, formatDurationMs } from '@/shared/lib/formatters';

describe('chart formatters', () => {
  describe('formatDateLabel (x-axis formatter)', () => {
    it('formats ISO date string to short label', () => {
      expect(formatDateLabel('2026-03-01')).toContain('Mar');
    });

    it('formats full ISO datetime string', () => {
      expect(formatDateLabel('2026-03-01T14:30:00Z')).toContain('Mar');
    });

    it('formats different months correctly', () => {
      expect(formatDateLabel('2026-01-15')).toContain('Jan');
      expect(formatDateLabel('2026-06-20')).toContain('Jun');
      expect(formatDateLabel('2026-12-31')).toContain('Dec');
    });
  });

  describe('formatDurationMs (y-axis formatter)', () => {
    it('formats sub-second durations', () => {
      expect(formatDurationMs(456)).toBe('456ms');
    });

    it('formats multi-second durations', () => {
      expect(formatDurationMs(5000)).toBe('5s');
    });

    it('formats minute+ durations', () => {
      expect(formatDurationMs(125_000)).toBe('2m 5s');
    });

    it('handles zero', () => {
      expect(formatDurationMs(0)).toBe('0s');
    });
  });
});

describe('flaky percentage calculation', () => {
  function calculateFlakyPercentage(flakyCount: number, totalRuns: number): number {
    return totalRuns > 0 ? (flakyCount / totalRuns) * 100 : 0;
  }

  it('calculates correct percentage', () => {
    expect(calculateFlakyPercentage(8, 42)).toBeCloseTo(19.05, 1);
  });

  it('returns 0 when totalRuns is 0', () => {
    expect(calculateFlakyPercentage(5, 0)).toBe(0);
  });

  it('returns 100 when all runs are flaky', () => {
    expect(calculateFlakyPercentage(10, 10)).toBe(100);
  });

  it('handles large numbers', () => {
    expect(calculateFlakyPercentage(500, 10000)).toBe(5);
  });
});
