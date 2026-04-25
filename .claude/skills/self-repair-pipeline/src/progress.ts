/**
 * Progress-reporting helpers for long-running loops in the self-repair pipeline.
 *
 * Cadence rule: for small loops (N ≤ 50) log every iteration; for larger loops
 * log the first, last, and every N/20-th. A per-iteration slow-item check
 * ensures that a single abnormally slow step always produces a log line within
 * `SLOW_ITEM_MS`, so a hang becomes visible within seconds rather than hours.
 */

/**
 * Returns `true` if iteration `i` (0-indexed) of an N-item loop should emit a
 * regular progress log.
 */
export function should_log(i: number, n: number): boolean {
  if (n <= 0) return false;
  if (n <= 50) return true;
  const step = Math.ceil(n / 20);
  return i === 0 || i === n - 1 || (i + 1) % step === 0;
}

/**
 * Any single iteration that exceeds this threshold always logs, regardless of
 * cadence. This is the primary safety net for catching hangs early.
 */
export const SLOW_ITEM_MS = 5000;
