import { describe, expect, it } from "vitest";

import type { KnownIssue } from "../src/types.js";
import { sort_by_drift_priority, type DispatchEntry } from "./next_investigate_tasks.js";

function known(group_id: string, overrides: Partial<KnownIssue> = {}): KnownIssue {
  return {
    group_id,
    title: group_id,
    description: "",
    status: "wip",
    languages: ["typescript"],
    examples: [],
    classifier: { kind: "builtin", function_name: group_id, min_confidence: 0.9 },
    ...overrides,
  };
}

function dispatch(group_id: string): DispatchEntry {
  return {
    run_path: `/runs/${group_id}.json`,
    group_id,
    output_path: `/out/${group_id}.json`,
    get_context_cmd: `cmd ${group_id}`,
  };
}

describe("sort_by_drift_priority", () => {
  it("floats drift-flagged wip rules ahead of non-drifting siblings", () => {
    const registry = new Map<string, KnownIssue>([
      ["a", known("a")],
      ["b", known("b", { drift_detected: true })],
      ["c", known("c")],
    ]);
    const sorted = sort_by_drift_priority([dispatch("a"), dispatch("b"), dispatch("c")], registry);
    expect(sorted.map((e) => e.group_id)).toEqual(["b", "a", "c"]);
  });

  it("is stable — preserves original order within the same priority bucket", () => {
    const registry = new Map<string, KnownIssue>([
      ["a", known("a")],
      ["b", known("b")],
      ["c", known("c")],
    ]);
    const sorted = sort_by_drift_priority([dispatch("a"), dispatch("b"), dispatch("c")], registry);
    expect(sorted.map((e) => e.group_id)).toEqual(["a", "b", "c"]);
  });

  it("treats drift_detected on a permanent rule as low-priority (not a wip)", () => {
    // Only `wip` rules get the drift priority bump. A permanent rule with
    // drift_detected is an anomaly handled separately (manual quarantine).
    const registry = new Map<string, KnownIssue>([
      ["a", known("a")],
      ["b", known("b", { drift_detected: true, status: "permanent" })],
    ]);
    const sorted = sort_by_drift_priority([dispatch("a"), dispatch("b")], registry);
    expect(sorted.map((e) => e.group_id)).toEqual(["a", "b"]);
  });

  it("treats missing registry entries as low-priority (residual novel groups)", () => {
    const registry = new Map<string, KnownIssue>([["a", known("a", { drift_detected: true })]]);
    const sorted = sort_by_drift_priority([dispatch("novel"), dispatch("a")], registry);
    expect(sorted.map((e) => e.group_id)).toEqual(["a", "novel"]);
  });

  it("orders multiple drift-flagged wip rules among themselves by insertion order", () => {
    const registry = new Map<string, KnownIssue>([
      ["a", known("a", { drift_detected: true })],
      ["b", known("b", { drift_detected: true })],
      ["c", known("c")],
    ]);
    const sorted = sort_by_drift_priority([dispatch("c"), dispatch("b"), dispatch("a")], registry);
    expect(sorted.map((e) => e.group_id)).toEqual(["b", "a", "c"]);
  });
});
