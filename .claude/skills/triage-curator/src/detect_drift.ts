import type { QaResponse } from "./types.js";

/**
 * Outlier rate at or above which the classifier is considered drifting.
 * Tuneable constant — keep any change synchronised with tests in detect_drift.test.ts.
 */
export const DRIFT_OUTLIER_RATE_THRESHOLD = 0.15;

/**
 * True iff the share of outliers in this QA result meets or exceeds the
 * drift threshold. Zero members is never drift.
 */
export function detect_drift(qa: QaResponse, member_count: number): boolean {
  if (member_count <= 0) return false;
  const rate = qa.outliers.length / member_count;
  return rate >= DRIFT_OUTLIER_RATE_THRESHOLD;
}
