import { describe, it, expect } from "vitest";
import { finalize_aggregation } from "./finalize_aggregation.js";
import type { GroupInvestigation } from "./types.js";
import type { TriageEntry, TriageState } from "../triage_state_types.js";

function make_fp_entry(entry_index: number, group_id: string): TriageEntry {
  return {
    entry_index,
    name: `entry_${entry_index}`,
    file_path: "src/x.ts",
    start_line: 1,
    kind: "function",
    signature: null,
    route: "llm-triage",
    diagnosis: "callers-not-in-registry",
    known_source: null,
    status: "completed",
    result: {
      ariadne_correct: false,
      group_id,
      root_cause: "original",
      reasoning: "r",
    },
    error: null,
    is_exported: true,
    access_modifier: null,
    diagnostics: {
      grep_call_sites: [],
      ariadne_call_refs: [],
      diagnosis: "callers-not-in-registry",
    },
    auto_classified: false,
    classifier_hints: [],
  };
}

function make_state(entries: TriageEntry[]): TriageState {
  return {
    project_name: "proj",
    project_path: "/x",
    phase: "triage",
    entries,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

describe("finalize_aggregation", () => {
  it("applies confirmed member verdicts and flips phase to complete", () => {
    const state = make_state([
      make_fp_entry(1, "old-a"),
      make_fp_entry(2, "old-b"),
    ]);
    const investigations: GroupInvestigation[] = [
      {
        group_id: "canonical-a",
        root_cause: "cleaned cause",
        confirmed_members: [1, 2],
        rejected_members: [],
      },
    ];
    const summary = finalize_aggregation(state, investigations);
    expect(summary).toEqual({ assigned_count: 2, group_count: 1 });
    expect(state.phase).toBe("complete");
    expect(state.entries[0].result?.group_id).toBe("canonical-a");
    expect(state.entries[0].result?.root_cause).toBe("cleaned cause");
    expect(state.entries[1].result?.group_id).toBe("canonical-a");
  });

  it("routes rejects with a known suggested_group_id to that group", () => {
    const state = make_state([make_fp_entry(1, "old")]);
    const investigations: GroupInvestigation[] = [
      {
        group_id: "group-a",
        root_cause: "a",
        confirmed_members: [],
        rejected_members: [{ entry_index: 1, suggested_group_id: "group-b" }],
      },
      {
        group_id: "group-b",
        root_cause: "b",
        confirmed_members: [],
        rejected_members: [],
      },
    ];
    finalize_aggregation(state, investigations);
    expect(state.entries[0].result?.group_id).toBe("group-b");
  });

  it("routes rejects with an unknown suggested_group_id to residual-fp", () => {
    const state = make_state([make_fp_entry(1, "old")]);
    const investigations: GroupInvestigation[] = [
      {
        group_id: "group-a",
        root_cause: "a",
        confirmed_members: [],
        rejected_members: [{ entry_index: 1, suggested_group_id: "unknown" }],
      },
    ];
    finalize_aggregation(state, investigations);
    expect(state.entries[0].result?.group_id).toBe("residual-fp");
  });

  it("skips entries whose result is null (no pending entry is silently promoted)", () => {
    const entry: TriageEntry = {
      ...make_fp_entry(1, "old"),
      status: "pending",
      result: null,
    };
    const state = make_state([entry]);
    const investigations: GroupInvestigation[] = [
      {
        group_id: "canonical",
        root_cause: "c",
        confirmed_members: [1],
        rejected_members: [],
      },
    ];
    finalize_aggregation(state, investigations);
    expect(state.entries[0].result).toBeNull();
  });
});
