import type { KnownIssue, QaResponse } from "./types.js";

/**
 * Sample-outlier rate at or above which a QA'd classifier is considered
 * sufficiently broken to warrant re-investigation. Complementary to
 * `DRIFT_OUTLIER_RATE_THRESHOLD` in detect_drift.ts:
 *
 *   drift threshold  — outliers / full group  (sticky tag signal)
 *   promote threshold — outliers / QA sample  (classifier-broken signal)
 *
 * Tuneable constant — keep any change synchronised with tests.
 */
export const PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD = 0.4;

/**
 * Minimum QA sample size below which promotion is skipped as too noisy to act on.
 */
export const PROMOTE_MIN_SAMPLE_SIZE = 4;

export interface PromoteDecision {
  promote: boolean;
  sample_outlier_rate: number;
  /** Human-readable reason, used in the script's `skipped[]` audit output. */
  reason: string;
}

/**
 * Decide whether a QA'd group should be promoted into the investigator queue.
 *
 * Rules (first match wins):
 *   1. sample_size < PROMOTE_MIN_SAMPLE_SIZE         → skip (too noisy)
 *   2. registry_entry.status === "permanent"         → skip (promotion forbidden)
 *   3. outliers / sample_size >= threshold           → promote
 *   4. otherwise                                     → skip (classifier is fine)
 */
export function should_promote_to_investigate(
  qa: QaResponse,
  sample_size: number,
  registry_entry: KnownIssue,
): PromoteDecision {
  const outlier_count = qa.outliers.length;
  const sample_outlier_rate = sample_size > 0 ? outlier_count / sample_size : 0;

  if (sample_size < PROMOTE_MIN_SAMPLE_SIZE) {
    return {
      promote: false,
      sample_outlier_rate,
      reason: `sample_size ${sample_size} below minimum ${PROMOTE_MIN_SAMPLE_SIZE}`,
    };
  }

  if (registry_entry.status === "permanent") {
    return {
      promote: false,
      sample_outlier_rate,
      reason: "registry entry has status \"permanent\"; promotion forbidden",
    };
  }

  if (sample_outlier_rate >= PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD) {
    return {
      promote: true,
      sample_outlier_rate,
      reason: `sample outlier rate ${sample_outlier_rate.toFixed(2)} >= ${PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD}`,
    };
  }

  return {
    promote: false,
    sample_outlier_rate,
    reason: `sample outlier rate ${sample_outlier_rate.toFixed(2)} < ${PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD}`,
  };
}
