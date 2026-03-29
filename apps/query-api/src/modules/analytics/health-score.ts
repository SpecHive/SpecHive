export interface HealthScoreInput {
  passRate: number;
  flakyRate: number;
  skipRate: number;
  avgDurationMs: number;
  orgMedianDurationMs: number;
  projectCount: number;
}

/** Clamps NaN/Infinity to `min`, otherwise clamps to [min, max]. */
function sanitize(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Quadratic flaky penalty: gentle at low rates, severe at high rates.
 *
 *   0% → 100 | 5% → 90.3 | 15% → 72.3 | 30% → 49.0 | 50% → 25.0
 */
export function computeFlakyScore(flakyRate: number): number {
  const normalised = sanitize(flakyRate) / 100;
  return 100 * (1 - normalised) * (1 - normalised);
}

/**
 * Duration score with smooth linear decay from 0.5× to 3.0× median.
 *
 * Returns a neutral score (80) when the org has fewer than 3 projects
 * or the median is zero, since the baseline would be unreliable.
 *
 *   ≤0.5× → 100 | 1.0× → 80 | 1.5× → 60 | 2.0× → 40 | 3.0× → 0
 */
export function computeDurationScore(
  avgDurationMs: number,
  orgMedianDurationMs: number,
  projectCount: number,
): number {
  if (projectCount < 3 || orgMedianDurationMs <= 0) return 80;

  const ratio = avgDurationMs / orgMedianDurationMs;
  if (ratio <= 0.5) return 100;

  return clamp(0, 100, 100 * (1 - (ratio - 0.5) / 2.5));
}

/** Safe percentage: (numerator / denominator) × 100, rounded to 2dp. Returns 0 when denominator is 0. */
export function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : 0;
}

/**
 * Computes the median of an array of durations.
 * Returns 0 for an empty array.
 */
export function computeOrgMedianDuration(durations: number[]): number {
  if (durations.length === 0) return 0;

  const sorted = durations.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/**
 * Computes a composite health score (0-100) for a test project.
 *
 * Components and weights:
 *   - clean pass rate    45 %  (passRate minus flakyRate — first-try reliability)
 *   - flaky score        30 %  (quadratic penalty)
 *   - skip score         15 %  (inverted)
 *   - duration score     10 %  (smooth decay relative to org median)
 *
 * An execution guard progressively zeroes out the score when skipRate
 * exceeds 80 %, ensuring nearly-all-skipped projects score near 0.
 *
 * The final value is rounded to one decimal place.
 */
export function computeHealthScore(input: HealthScoreInput): number {
  const passRate = sanitize(input.passRate);
  const flakyRate = sanitize(input.flakyRate);
  const skipRate = sanitize(input.skipRate);
  const avgDurMs = sanitize(input.avgDurationMs, 0, Number.MAX_SAFE_INTEGER);
  const orgMedMs = sanitize(input.orgMedianDurationMs, 0, Number.MAX_SAFE_INTEGER);
  const projCount = Math.max(
    0,
    Math.trunc(sanitize(input.projectCount, 0, Number.MAX_SAFE_INTEGER)),
  );

  const cleanPassRate = Math.max(0, passRate - flakyRate);
  const flakyScore = computeFlakyScore(flakyRate);
  const durationScore = computeDurationScore(avgDurMs, orgMedMs, projCount);

  let raw = cleanPassRate * 0.45 + flakyScore * 0.3 + (100 - skipRate) * 0.15 + durationScore * 0.1;

  // Execution guard: when skip rate exceeds 80 %, progressively zero out
  // the score. A project with nearly all tests skipped should not appear healthy.
  if (skipRate > 80) {
    raw *= Math.max(0, 1 - (skipRate - 80) / 20);
  }

  return Math.round(clamp(0, 100, raw) * 10) / 10;
}
