import { describe, it, expect } from "vitest";
import { pick_next_entries } from "./get_next_triage_entry.js";
import type { TriageEntry } from "../src/triage_state_types.js";

function make_entry(overrides: Partial<TriageEntry> & { entry_index: number }): TriageEntry {
  return {
    name: `entry_${overrides.entry_index}`,
    file_path: "src/x.ts",
    start_line: 1,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "callers-not-in-registry",
    known_source: null,
    status: "pending",
    result: null,
    error: null,
    is_exported: true,
    access_modifier: null,
    diagnostics: {
      grep_call_sites: [],
      grep_call_sites_unindexed_tests: [],
      ariadne_call_refs: [],
      diagnosis: "callers-not-in-registry",
    },
    auto_classified: false,
    classifier_hints: [],
    ...overrides,
  };
}

describe("pick_next_entries", () => {
  it("returns the first pending entry", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0, status: "completed" }),
      make_entry({ entry_index: 1 }),
      make_entry({ entry_index: 2 }),
    ];
    expect(pick_next_entries(entries, 1, new Set())).toEqual([1]);
  });

  it("respects --count", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0 }),
      make_entry({ entry_index: 1 }),
      make_entry({ entry_index: 2 }),
    ];
    expect(pick_next_entries(entries, 2, new Set())).toEqual([0, 1]);
  });

  it("excludes entries listed in active", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0 }),
      make_entry({ entry_index: 1 }),
      make_entry({ entry_index: 2 }),
    ];
    expect(pick_next_entries(entries, 2, new Set([0]))).toEqual([1, 2]);
  });

  it("skips auto_classified entries even if status is pending", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0, status: "pending", auto_classified: true }),
      make_entry({ entry_index: 1 }),
    ];
    expect(pick_next_entries(entries, 2, new Set())).toEqual([1]);
  });

  it("returns [] when nothing is pickable", () => {
    const entries: TriageEntry[] = [
      make_entry({ entry_index: 0, status: "completed" }),
      make_entry({ entry_index: 1, status: "pending", auto_classified: true }),
    ];
    expect(pick_next_entries(entries, 5, new Set())).toEqual([]);
  });
});
