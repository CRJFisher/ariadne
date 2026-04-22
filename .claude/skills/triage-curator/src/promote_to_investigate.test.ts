import { describe, expect, it } from "vitest";

import {
  PROMOTE_MIN_SAMPLE_SIZE,
  PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD,
  should_promote_to_investigate,
} from "./promote_to_investigate.js";
import type { KnownIssue, KnownIssueStatus, QaResponse } from "./types.js";

function qa(n_outliers: number): QaResponse {
  return {
    group_id: "g",
    outliers: Array.from({ length: n_outliers }, (_, i) => ({
      entry_index: i,
      reason: "misclassified",
    })),
    notes: "",
  };
}

function registry_entry(status: KnownIssueStatus): KnownIssue {
  return {
    group_id: "g",
    title: "t",
    description: "d",
    status,
    languages: ["ts"],
    examples: [],
    classifier: { kind: "none" },
  };
}

describe("should_promote_to_investigate", () => {
  it("threshold constant is 40% sample-outlier rate", () => {
    expect(PROMOTE_SAMPLE_OUTLIER_RATE_THRESHOLD).toBe(0.4);
  });

  it("minimum sample size is 4", () => {
    expect(PROMOTE_MIN_SAMPLE_SIZE).toBe(4);
  });

  it("promotes at exactly 40% (4 / 10)", () => {
    const d = should_promote_to_investigate(qa(4), 10, registry_entry("wip"));
    expect(d.promote).toBe(true);
    expect(d.sample_outlier_rate).toBe(0.4);
  });

  it("promotes above threshold (5 / 10)", () => {
    const d = should_promote_to_investigate(qa(5), 10, registry_entry("wip"));
    expect(d.promote).toBe(true);
  });

  it("does not promote below threshold (3 / 10)", () => {
    const d = should_promote_to_investigate(qa(3), 10, registry_entry("wip"));
    expect(d.promote).toBe(false);
    expect(d.sample_outlier_rate).toBe(0.3);
  });

  it("skips when sample size is below minimum even if 100% outliers", () => {
    const d = should_promote_to_investigate(qa(3), 3, registry_entry("wip"));
    expect(d.promote).toBe(false);
    expect(d.reason).toContain("sample_size 3 below minimum 4");
  });

  it("skips permanent-status entries regardless of outlier rate", () => {
    const d = should_promote_to_investigate(qa(10), 10, registry_entry("permanent"));
    expect(d.promote).toBe(false);
    expect(d.reason).toContain("permanent");
  });

  it("promotes when status is fixed but outlier rate is high", () => {
    const d = should_promote_to_investigate(qa(5), 10, registry_entry("fixed"));
    expect(d.promote).toBe(true);
  });

  it("computes zero rate for zero-sample edge case without dividing by zero", () => {
    const d = should_promote_to_investigate(qa(0), 0, registry_entry("wip"));
    expect(d.promote).toBe(false);
    expect(d.sample_outlier_rate).toBe(0);
  });

  it("does not promote with zero outliers", () => {
    const d = should_promote_to_investigate(qa(0), 10, registry_entry("wip"));
    expect(d.promote).toBe(false);
  });

  it("sample-size check takes precedence over permanent status", () => {
    const d = should_promote_to_investigate(qa(2), 2, registry_entry("permanent"));
    expect(d.promote).toBe(false);
    expect(d.reason).toContain("sample_size");
  });
});
