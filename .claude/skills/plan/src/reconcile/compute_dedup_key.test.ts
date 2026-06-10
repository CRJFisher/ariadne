import { describe, expect, it } from "vitest";

import { parse_run_id } from "@ariadnejs/skill-protocol";
import type { PlanTaskEvidence } from "../store/plan_task.js";

import { compute_dedup_key } from "./compute_dedup_key.js";

const RUN = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");

function ev(file: string, line: number): PlanTaskEvidence {
  return {
    member_evidence: { file, line, why: "w" },
    member_symbol: { file_path: file, name: "flagged_fn", kind: "function", start_line: line },
    project: "p",
    run_id: RUN,
    diagnosis: "callers-not-in-registry",
    resolution_failure: null,
    has_uncaptured_indexed_grep_hit: false,
    callers_only_in_unindexed_tests: false,
  };
}

describe("compute_dedup_key", () => {
  it("is order-independent over the evidence location set", () => {
    const forward = compute_dedup_key("name_resolution", [ev("a.ts", 1), ev("b.ts", 2)]);
    const reverse = compute_dedup_key("name_resolution", [ev("b.ts", 2), ev("a.ts", 1)]);
    expect(forward).toEqual(reverse);
  });

  it("dedups identical file:line rows before hashing", () => {
    const with_dup = compute_dedup_key("name_resolution", [ev("a.ts", 1), ev("a.ts", 1)]);
    const without = compute_dedup_key("name_resolution", [ev("a.ts", 1)]);
    expect(with_dup).toEqual(without);
  });

  it("differs when a line differs", () => {
    expect(compute_dedup_key("name_resolution", [ev("a.ts", 1)])).not.toEqual(
      compute_dedup_key("name_resolution", [ev("a.ts", 2)]),
    );
  });

  it("differs when the fault_area differs for the same locations", () => {
    expect(compute_dedup_key("name_resolution", [ev("a.ts", 1)])).not.toEqual(
      compute_dedup_key("method_lookup", [ev("a.ts", 1)]),
    );
  });

  it("ignores provenance (project/run) and the raw fault signal", () => {
    const base = compute_dedup_key("name_resolution", [ev("a.ts", 1)]);
    const other_provenance: PlanTaskEvidence = {
      ...ev("a.ts", 1),
      project: "different",
      run_id: parse_run_id("ccccccc-2026-04-18T00-00-00.000Z"),
      diagnosis: "no-textual-callers",
      has_uncaptured_indexed_grep_hit: true,
    };
    expect(compute_dedup_key("name_resolution", [other_provenance])).toEqual(base);
  });

  it("is the pinned sha256 hex of `<fault_area>\\n<file>:<line>` (cross-sweep stable)", () => {
    // sha256("name_resolution\na.ts:1") — the exact recipe, pinned so a change
    // to the payload format is caught (it would re-key every existing task).
    expect(compute_dedup_key("name_resolution", [ev("a.ts", 1)])).toEqual(
      "b5e792301e9247f30ac9e7a7515ca4be6b5c73d0ca32645a9fd9b29396d94fbe",
    );
  });
});
