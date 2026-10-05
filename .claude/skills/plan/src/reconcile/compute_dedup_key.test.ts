import { describe, expect, it } from "vitest";

import { parse_run_id } from "@ariadnejs/skill-protocol";
import type { PlanTaskEvidence } from "../store/plan_task.js";

import { compute_dedup_key } from "./compute_dedup_key.js";

const RUN = parse_run_id("aaaaaaa-2026-04-16T18-10-16.855Z");

/**
 * One evidence row. `member` defaults to the call-site `file` so a caller that
 * passes only `(file, line)` gets a member whose identity tracks the file — the
 * common case. Tests that exercise line-drift tolerance vary `line` while
 * holding `member` fixed.
 */
function ev(
  file: string,
  line: number,
  member: { file_path?: string; name?: string; kind?: "function" | "method" | "constructor" } = {},
): PlanTaskEvidence {
  return {
    member_evidence: { file, line, why: "w" },
    member_symbol: {
      file_path: member.file_path ?? file,
      name: member.name ?? "flagged_fn",
      kind: member.kind ?? "function",
      start_line: line,
    },
    project: "p",
    run_id: RUN,
    diagnosis: "callers-not-in-registry",
    resolution_failure: null,
    has_uncaptured_indexed_grep_hit: false,
  };
}

describe("compute_dedup_key", () => {
  it("is order-independent over the member set", () => {
    const forward = compute_dedup_key("name_resolution", [
      ev("a.ts", 1, { name: "fn_a" }),
      ev("b.ts", 2, { name: "fn_b" }),
    ]);
    const reverse = compute_dedup_key("name_resolution", [
      ev("b.ts", 2, { name: "fn_b" }),
      ev("a.ts", 1, { name: "fn_a" }),
    ]);
    expect(forward).toEqual(reverse);
  });

  it("collapses rows that share a member but differ only in line (drift tolerance)", () => {
    // Two call sites of the same flagged member at shifted lines hash identically:
    // a target-repo commit that moves the member does not re-key its task.
    const shifted = compute_dedup_key("method_lookup", [ev("a.ts", 10), ev("a.ts", 42)]);
    const single = compute_dedup_key("method_lookup", [ev("a.ts", 10)]);
    expect(shifted).toEqual(single);
  });

  it("dedups identical member tokens before hashing", () => {
    const with_dup = compute_dedup_key("name_resolution", [ev("a.ts", 1), ev("a.ts", 1)]);
    const without = compute_dedup_key("name_resolution", [ev("a.ts", 1)]);
    expect(with_dup).toEqual(without);
  });

  it("differs when a member's file changes", () => {
    expect(compute_dedup_key("name_resolution", [ev("a.ts", 1)])).not.toEqual(
      compute_dedup_key("name_resolution", [ev("a.ts", 1, { file_path: "b.ts" })]),
    );
  });

  it("differs when a member's name changes", () => {
    expect(compute_dedup_key("name_resolution", [ev("a.ts", 1, { name: "one" })])).not.toEqual(
      compute_dedup_key("name_resolution", [ev("a.ts", 1, { name: "two" })]),
    );
  });

  it("differs when the fault_area differs for the same members", () => {
    expect(compute_dedup_key("name_resolution", [ev("a.ts", 1)])).not.toEqual(
      compute_dedup_key("method_lookup", [ev("a.ts", 1)]),
    );
  });

  it("ignores provenance (project/run), the raw fault signal, and the call-site line", () => {
    const base = compute_dedup_key("name_resolution", [ev("a.ts", 1)]);
    const other_provenance: PlanTaskEvidence = {
      ...ev("a.ts", 999),
      project: "different",
      run_id: parse_run_id("ccccccc-2026-04-18T00-00-00.000Z"),
      diagnosis: "no-textual-callers",
      has_uncaptured_indexed_grep_hit: true,
    };
    expect(compute_dedup_key("name_resolution", [other_provenance])).toEqual(base);
  });

  it("is the pinned sha256 hex of `<fault_area>\\n<file_path>\\0<name>\\0<kind>` (cross-sweep stable)", () => {
    // sha256("name_resolution\na.ts\0flagged_fn\0function") — the exact recipe,
    // pinned so a change to the payload format is caught (it would re-key every
    // existing task).
    expect(compute_dedup_key("name_resolution", [ev("a.ts", 1)])).toEqual(
      "2e45eb7d420140ca3cafb0c09774f9f16904eb51c896cdce1274712062f2f6d3",
    );
  });
});
