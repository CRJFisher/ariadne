import { describe, expect, it } from "vitest";

import { DRIFT_OUTLIER_RATE_THRESHOLD, detect_drift } from "./detect_drift.js";
import type { QaResponse } from "./types.js";

function qa(n_outliers: number): QaResponse {
  return {
    group_id: "g",
    outliers: Array.from({ length: n_outliers }, (_, i) => ({
      entry_index: i,
      reason: "looks wrong",
    })),
    notes: "",
  };
}

describe("detect_drift", () => {
  it("threshold constant is 15%", () => {
    expect(DRIFT_OUTLIER_RATE_THRESHOLD).toBe(0.15);
  });

  it("fires at exactly 15% (3 / 20)", () => {
    expect(detect_drift(qa(3), 20)).toBe(true);
  });

  it("does not fire at 10% (2 / 20)", () => {
    expect(detect_drift(qa(2), 20)).toBe(false);
  });

  it("does not fire at 14% (7 / 50)", () => {
    expect(detect_drift(qa(7), 50)).toBe(false);
  });

  it("fires above the threshold (10 / 20)", () => {
    expect(detect_drift(qa(10), 20)).toBe(true);
  });

  it("returns false for zero members (guard against divide-by-zero)", () => {
    expect(detect_drift(qa(0), 0)).toBe(false);
    expect(detect_drift(qa(5), 0)).toBe(false);
  });

  it("returns false for zero outliers regardless of size", () => {
    expect(detect_drift(qa(0), 100)).toBe(false);
  });
});
