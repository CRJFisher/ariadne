import { describe, it, expect } from "vitest";
import { prepare_slices } from "./prepare_slices.js";
import type { TriageEntry, TriageState } from "../triage_state_types.js";

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
      ariadne_call_refs: [],
      diagnosis: "callers-not-in-registry",
    },
    auto_classified: false,
    classifier_hints: [],
    ...overrides,
  };
}

describe("prepare_slices", () => {
  it("returns empty when no entries are completed false positives", () => {
    const state = make_state([
      make_entry({ entry_index: 0, status: "pending" }),
      make_entry({
        entry_index: 1,
        status: "completed",
        result: {
          ariadne_correct: true,
          group_id: "confirmed-unreachable",
          root_cause: "x",
          reasoning: "y",
        },
      }),
    ]);
    expect(prepare_slices(state, 50)).toEqual([]);
  });

  it("filters completed false positives and projects slice entry shape", () => {
    const state = make_state([
      make_entry({
        entry_index: 5,
        name: "fp_func",
        file_path: "src/a.ts",
        kind: "method",
        is_exported: true,
        status: "completed",
        diagnosis: "callers-in-registry-unresolved",
        result: {
          ariadne_correct: false,
          group_id: "inv-group",
          root_cause: "x",
          reasoning: "y",
        },
      }),
    ]);
    expect(prepare_slices(state, 50)).toEqual([
      {
        slice_id: 0,
        entries: [
          {
            entry_index: 5,
            name: "fp_func",
            file_path: "src/a.ts",
            kind: "method",
            investigator_group_id: "inv-group",
            diagnosis_category: "callers-in-registry-unresolved",
            is_exported: true,
          },
        ],
      },
    ]);
  });

  it("paginates entries by slice_size", () => {
    const fp_result = {
      ariadne_correct: false,
      group_id: "g",
      root_cause: "r",
      reasoning: "why",
    } as const;
    const entries = Array.from({ length: 7 }, (_, i) =>
      make_entry({ entry_index: i, status: "completed", result: { ...fp_result } }),
    );
    const slices = prepare_slices(make_state(entries), 3);
    expect(slices.map((s) => ({ slice_id: s.slice_id, size: s.entries.length }))).toEqual([
      { slice_id: 0, size: 3 },
      { slice_id: 1, size: 3 },
      { slice_id: 2, size: 1 },
    ]);
  });
});
