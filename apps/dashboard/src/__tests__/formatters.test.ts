import { describe, it, expect } from 'vitest';

import {
  computePassRate,
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  truncateId,
} from '@/lib/formatters';

describe('formatDuration', () => {
  it('returns "—" when startedAt is null', () => {
    expect(formatDuration(null, '2026-01-01T00:00:00Z')).toBe('—');
  });

  it('returns "—" when finishedAt is null', () => {
    expect(formatDuration('2026-01-01T00:00:00Z', null)).toBe('—');
  });

  it('returns "< 1s" for sub-second durations', () => {
    expect(formatDuration('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.500Z')).toBe('< 1s');
  });

  it('formats seconds only', () => {
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:00:45Z')).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration('2026-01-01T00:00:00Z', '2026-01-01T00:02:34Z')).toBe('2m 34s');
  });
});

describe('formatRelativeTime', () => {
  it('returns "—" for null', () => {
    expect(formatRelativeTime(null)).toBe('—');
  });

  it('returns "just now" for recent times', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5 min ago');
  });

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });
});

describe('formatDateTime', () => {
  it('returns "—" for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('formats a date string', () => {
    const result = formatDateTime('2026-02-27T14:32:00Z');
    expect(result).toContain('Feb');
    expect(result).toContain('27');
    expect(result).toContain('2026');
  });
});

describe('truncateId', () => {
  it('returns first 8 characters', () => {
    expect(truncateId('0193a1b2-c3d4-7e5f-a6b7-c8d9e0f12345')).toBe('0193a1b2');
  });

  it('handles short strings', () => {
    expect(truncateId('abc')).toBe('abc');
  });
});

describe('computePassRate', () => {
  it('returns 0 when total is 0', () => {
    expect(computePassRate(0, 0)).toBe(0);
  });

  it('computes correct percentage', () => {
    expect(computePassRate(90, 100)).toBe(90);
  });

  it('rounds to one decimal', () => {
    expect(computePassRate(1, 3)).toBeCloseTo(33.3, 0);
  });
});
